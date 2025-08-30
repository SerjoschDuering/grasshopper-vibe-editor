# get\_context: Full Grasshopper Context → JSON (with DAG stages)

This document adds a **server-side** `get_context` capability to your GHPython socket server. It returns the **full Grasshopper graph as JSON**, plus a **component-level consolidated view** ordered by a **topological (DAG) execution order** with a `stage` attribute. It is designed to integrate with the server code you shared (socket server, `handle_request`, `process_command`).

> TL;DR
>
> * Call `POST {"type":"get_context", "options":{...}}` to receive the full graph and a high-level consolidated view.
> * The server computes **stages** (layers) so components in the same stage can conceptually run in parallel.
> * Optional **freeze** of the GH canvas during capture to avoid recomputation/layout jitter.

---

## 1) Imports & Encoder

Merge these with your existing imports. This extends your `GHEncoder` to cover `Guid`, `RectangleF`, and `Rhino.Geometry.Point3d` so the output stays JSON-serializable without custom post-processing.

```python
# === Add near imports ===
import Rhino
import Rhino.Geometry as rg

# Extend your GHEncoder to also serialize Point3d & RectangleF (keep your Guid handling)
class GHEncoder(json.JSONEncoder):
    def default(self, obj):
        try:
            if isinstance(obj, System.Guid):
                return str(obj)
        except:
            pass
        try:
            if isinstance(obj, rg.Point3d):
                return {"x": float(obj.X), "y": float(obj.Y), "z": float(obj.Z)}
        except:
            pass
        try:
            if isinstance(obj, RectangleF):
                return {"x": float(obj.X), "y": float(obj.Y), "width": float(obj.Width), "height": float(obj.Height)}
        except:
            pass
        # Fallback to default
        return json.JSONEncoder.default(self, obj)
```

---

## 2) Helpers (coords, runtime, filtering)

These keep your **inverted Y** convention and collect **runtime diagnostics** from both components and params.

```python
# Canvas → Web coordinate helpers (invert Y like your previous code)
def _rect_canvas_to_web(rect):
    try:
        return RectangleF(rect.X, (rect.Y * -1) - rect.Height, rect.Width, rect.Height)
    except:
        return None

def _pt_canvas_to_web(pt):
    try:
        return rg.Point3d(pt.X, pt.Y * -1, 0)
    except:
        return None

# Runtime message collector (robust across GH builds)
try:
    from Grasshopper.Kernel import GH_RuntimeMessageLevel
except:
    GH_RuntimeMessageLevel = None

def _collect_runtime_messages(obj):
    msgs = {"errors": [], "warnings": [], "remarks": []}
    try:
        if GH_RuntimeMessageLevel and hasattr(obj, "RuntimeMessages"):
            try:
                for m in obj.RuntimeMessages(GH_RuntimeMessageLevel.Error):
                    msgs["errors"].append(str(getattr(m, "Message", m)))
            except: pass
            try:
                for m in obj.RuntimeMessages(GH_RuntimeMessageLevel.Warning):
                    msgs["warnings"].append(str(getattr(m, "Message", m)))
            except: pass
            try:
                for m in obj.RuntimeMessages(GH_RuntimeMessageLevel.Remark):
                    msgs["remarks"].append(str(getattr(m, "Message", m)))
            except: pass
        else:
            for attr, key in [("RuntimeErrors","errors"),("RuntimeWarnings","warnings")]:
                try:
                    arr = getattr(obj, attr, None)
                    if arr:
                        for m in arr:
                            msgs[key].append(str(m))
                except: pass
    except: pass
    try:
        bubble = getattr(obj, "Message", None)
        if bubble: msgs["remarks"].append(str(bubble))
    except: pass
    return msgs

# Small utilities for LOD and text labels
import copy

def _pick(d, keys):
    out = {}
    for k in keys:
        if k in d: out[k] = d[k]
    return out

def _runtime_counts(rt):
    if not rt: return {"errors":0,"warnings":0,"remarks":0}
    return {"errors":len(rt.get("errors",[])), "warnings":len(rt.get("warnings",[])), "remarks":len(rt.get("remarks",[]))}
```

---

## 3) Node summarizers (params & components)

These are based on your earlier `get_param_info` and component info, with runtime + inverted coordinates.

```python
from Grasshopper.Kernel import IGH_Param

# Param summarizer (child of a component or standalone)
def get_param_info(param, parent_component=None):
    try:
        bounds_rect = _rect_canvas_to_web(param.Attributes.Bounds) if hasattr(param, "Attributes") else None
        pivot_pt = _pt_canvas_to_web(param.Attributes.Pivot) if hasattr(param, "Attributes") else None
        data_count = param.VolatileData.DataCount if hasattr(param, "VolatileData") else None
        path_count = param.VolatileData.PathCount if hasattr(param, "VolatileData") else None

        info = {
            "instanceGuid": str(param.InstanceGuid),
            "componentGuid": str(parent_component) if parent_component else None,
            "bounds": bounds_rect,
            "pivot": pivot_pt,
            "dataMapping": str(getattr(param, "DataMapping", None)) if hasattr(param, "DataMapping") else None,
            "dataType": str(getattr(param, "TypeName", None)) if hasattr(param, "TypeName") else None,
            "simplify": str(getattr(param, "Simplify", None)) if hasattr(param, "Simplify") else None,
            "computiationTime": float(param.ProcessorTime.Milliseconds) if hasattr(param, "ProcessorTime") else None,
            "name": param.Name,
            "nickName": param.NickName,
            "category": getattr(param, "Category", None),
            "subCategory": getattr(param, "SubCategory", None),
            "description": getattr(param, "Description", None),
            "kind": "param",
            "dataCount": data_count,
            "pathCount": path_count,
            "hasData": (data_count is not None and data_count > 0),
            "sources": [],
            "targets": [],
            "runtime": _collect_runtime_messages(param)
        }
        try:
            for src in param.Sources:
                if src: info["sources"].append(str(src.InstanceGuid))
        except: pass
        try:
            for tgt in param.Recipients:
                if tgt: info["targets"].append(str(tgt.InstanceGuid))
        except: pass
        return info
    except Exception as e:
        print("Error getting param info: "+str(e))
        return None

# Component summarizer
def _get_component_info(obj):
    try:
        comp_guid = str(obj.InstanceGuid)
        try:
            kind = str(obj.Kind) if hasattr(obj, "Kind") else str(obj.__class__.__name__)
        except:
            kind = str(obj.__class__.__name__)
        info = {
            "instanceGuid": comp_guid,
            "name": getattr(obj, "Name", ""),
            "nickName": getattr(obj, "NickName", ""),
            "description": getattr(obj, "Description", ""),
            "category": getattr(obj, "Category", None),
            "subCategory": getattr(obj, "SubCategory", None),
            "kind": "component",
            "bounds": _rect_canvas_to_web(obj.Attributes.Bounds) if hasattr(obj, "Attributes") else None,
            "pivot": _pt_canvas_to_web(obj.Attributes.Pivot) if hasattr(obj, "Attributes") else None,
            "computiationTime": float(obj.ProcessorTime.Milliseconds) if hasattr(obj, "ProcessorTime") else None,
            "sources": [],
            "targets": [],
            "isScript": bool(hasattr(obj, "Code")),
            "locked": bool(getattr(obj, "Locked", False)),
            "hidden": bool(getattr(obj, "Hidden", False)),
            "enabled": not bool(getattr(obj, "Locked", False)),
            "runtime": _collect_runtime_messages(obj)
        }
        try:
            if hasattr(obj, "Code"): info["code"] = obj.Code
        except: pass
        return info
    except Exception as e:
        print("Error getting component info: "+str(e))
        return None
```

---

## 4) Build the full graph (param-level) and consolidated graph (component-level)

The **full graph** is keyed by `instanceGuid` and includes both **components** and **params**, with `sources` and `targets`. The **consolidated** view collapses param wires to **component↔component** edges and builds text IO signatures.

```python
# Detect whether a param is an input or output of its parent component

def _is_input_param(p):
    pc = p.get("componentGuid")
    if not pc: return False
    for t in p.get("targets", []) or []:
        if t == pc: return True
    return False

def _is_output_param(p):
    pc = p.get("componentGuid")
    return bool(pc) and not _is_input_param(p)

# Build consolidated component-level view from full param graph

def consolidate_graph_component_level(graph, options=None):
    if options is None: options = {}
    text_mode = options.get("text_mode", "nickOrName")  # "nickOrName"|"name"|"nick"
    include_io = bool(options.get("include_io_signatures", True))
    include_edges = bool(options.get("include_edges", True))
    include_loose = bool(options.get("include_standalone_params", False))
    dedupe_channels = bool(options.get("dedupe_channels", True))
    max_desc_len = options.get("max_desc_len", None)

    def label_of(n):
        nick = n.get("nickName"); name = n.get("name")
        if text_mode == "name": return name
        if text_mode == "nick": return nick
        return nick or name

    components, params = {}, {}
    for gid, node in graph.items():
        if node.get("kind") == "param" or ("componentGuid" in node and node["componentGuid"] is not None):
            params[gid] = node
        else:
            components[gid] = node

    comp_io = {}
    for pid, p in params.items():
        pc = p.get("componentGuid")
        if not pc: continue
        if pc not in comp_io: comp_io[pc] = {"inputs": [], "outputs": []}
        sig = {
            "id": pid,
            "label": label_of(p),
            "type": p.get("dataType"),
            "hasData": p.get("hasData"),
            "dataCount": p.get("dataCount"),
            "description": p.get("description")
        }
        if max_desc_len and isinstance(sig.get("description"), basestring) and len(sig["description"]) > max_desc_len:
            sig["description"] = sig["description"][:max_desc_len] + "\u2026"
        if _is_input_param(p):
            comp_io[pc]["inputs"].append(sig)
        elif _is_output_param(p):
            comp_io[pc]["outputs"].append(sig)

    edge_map = {}  # (A,B) -> list of channels
    if include_edges:
        for pid, p in params.items():
            if not _is_output_param(p):
                continue
            a_comp = p.get("componentGuid")
            if not a_comp: continue
            for tgt in p.get("targets", []) or []:
                tnode = graph.get(tgt)
                if not tnode: continue
                b_comp = tnode.get("componentGuid") if tnode.get("kind") == "param" else None
                if not b_comp: continue
                ch = {
                    "fromParam": label_of(p),
                    "toParam": label_of(tnode),
                    "fromParamId": pid,
                    "toParamId": tgt,
                    "dataType": p.get("dataType")
                }
                key = (a_comp, b_comp)
                if key not in edge_map: edge_map[key] = []
                if dedupe_channels:
                    exists = False
                    for ex in edge_map[key]:
                        if ex["fromParamId"] == ch["fromParamId"] and ex["toParamId"] == ch["toParamId"]:
                            exists = True; break
                    if not exists: edge_map[key].append(ch)
                else:
                    edge_map[key].append(ch)

    out_components = []
    for cid, c in components.items():
        entry = {
            "id": cid,
            "name": c.get("name"),
            "nickName": c.get("nickName"),
            "kind": c.get("kind"),
            "category": c.get("category"),
            "subCategory": c.get("subCategory"),
            "isScript": c.get("isScript"),
            "runtimeCounts": _runtime_counts(c.get("runtime"))
        }
        if include_io:
            io = comp_io.get(cid, {"inputs": [], "outputs": []})
            entry["inputs"], entry["outputs"] = io["inputs"], io["outputs"]
        out_components.append(entry)

    out_edges = []
    if include_edges:
        for (a,b), channels in edge_map.items():
            out_edges.append({
                "from": a, "to": b,
                "channels": channels,
                "channelCount": len(channels)
            })

    standalone = []
    if include_loose:
        for pid, p in params.items():
            if not p.get("componentGuid"):
                standalone.append({
                    "id": pid,
                    "label": (p.get("nickName") or p.get("name")),
                    "type": p.get("dataType"),
                    "hasData": p.get("hasData"),
                    "dataCount": p.get("dataCount"),
                    "description": p.get("description")
                })

    return {
        "components": out_components,
        "edges": out_edges,
        "standaloneParams": standalone,
        "meta": {
            "count_components": len(out_components),
            "count_edges": len(out_edges),
            "count_standalone_params": len(standalone),
            "text_mode": text_mode
        }
    }
```

---

## 5) DAG ordering (stages) and annotation back into the full graph

We compute a **topological order** on the consolidated component graph, then annotate `stage` on **components** and propagate to their **params**.

```python
# Optional: use component X-position (bounds.x) for tie-break stability

def _pos_map_from_full_graph(graph):
    pos = {}
    for gid, n in graph.items():
        if n.get("kind") == "component":
            b = n.get("bounds")
            if b and "x" in b:
                try: pos[gid] = float(b["x"])
                except: pass
    return pos

# Order consolidated view and annotate stages

def order_high_level_dag(high_level, pos_map=None):
    comps = list(high_level.get("components", []))
    edges = list(high_level.get("edges", []))

    ids, id2comp = [], {}
    for c in comps:
        cid = c.get("id")
        if cid: ids.append(cid); id2comp[cid] = c

    adj, indeg, preds = {}, {}, {}
    for cid in ids:
        adj[cid] = []
        indeg[cid] = 0
        preds[cid] = set()

    for e in edges:
        u, v = e.get("from"), e.get("to")
        if u in id2comp and v in id2comp:
            adj[u].append(v)
            indeg[v] += 1
            preds[v].add(u)

    def sort_key(cid):
        x = pos_map.get(cid, 1e12) if pos_map else 1e12
        name = id2comp[cid].get("name") or ""
        nick = id2comp[cid].get("nickName") or ""
        return (x, name, nick, cid)

    queue = [cid for cid in ids if indeg[cid] == 0]
    queue.sort(key=sort_key)
    order = []
    stage = {}
    for cid in queue: stage[cid] = 0

    # Kahn's algorithm
    while queue:
        u = queue.pop(0)
        order.append(u)
        for v in adj[u]:
            s = stage.get(v, 0)
            if stage.get(u, 0) + 1 > s:
                stage[v] = stage.get(u, 0) + 1
            indeg[v] -= 1
            if indeg[v] == 0:
                queue.append(v)
                queue.sort(key=sort_key)

    # If cycles exist, place remaining deterministically
    if len(order) < len(ids):
        remaining = [cid for cid in ids if cid not in order]
        remaining.sort(key=sort_key)
        for cid in remaining:
            maxp = -1
            for p in preds.get(cid, []):
                if p in stage and stage[p] > maxp: maxp = stage[p]
            stage[cid] = (maxp + 1) if maxp >= 0 else 0
            order.append(cid)

    # Annotate & sort components
    for cid in ids:
        c = id2comp[cid]
        c["stage"] = int(stage.get(cid, 0))
        c["inDegree"] = int(sum(1 for p in preds.get(cid, []) if p in id2comp))
        c["outDegree"] = int(len(adj.get(cid, [])))

    comps_sorted = sorted(comps, key=lambda c: (c.get("stage",0), (pos_map.get(c.get("id"), 1e12) if pos_map else 1e12), c.get("name") or "", c.get("nickName") or "", c.get("id")))
    high_level["components"] = comps_sorted

    def edge_key(e):
        u, v = e.get("from"), e.get("to")
        su, sv = stage.get(u,0), stage.get(v,0)
        return (min(su, sv), (pos_map.get(u,1e12) if pos_map else 1e12), (pos_map.get(v,1e12) if pos_map else 1e12), u, v)
    high_level["edges"] = sorted(edges, key=edge_key)

    # Stages list
    max_stage = 0
    for cid in ids:
        if stage.get(cid, 0) > max_stage: max_stage = stage[cid]
    stages = []
    for s in range(max_stage + 1):
        bucket = [cid for cid in order if stage.get(cid,0) == s]
        stages.append(bucket)

    meta = high_level.get("meta", {})
    meta["topo_order"], meta["stages"], meta["max_stage"] = order, stages, max_stage
    high_level["meta"] = meta
    return high_level

# Propagate component stages back into the full graph (params inherit their component stage)

def _annotate_stages_into_full_graph(full_graph, high_level):
    comp_stage = {}
    for c in high_level.get("components", []):
        comp_stage[c.get("id")] = c.get("stage", 0)
    for gid, node in full_graph.items():
        if node.get("kind") == "component":
            node["stage"] = int(comp_stage.get(gid, 0))
        else:
            pc = node.get("componentGuid")
            if pc:
                node["stage"] = int(comp_stage.get(pc, 0))
            else:
                node["stage"] = 0  # standalone params default to 0
    return full_graph
```

---

## 6) The `get_context(options)` function

This is the main entry point the server will invoke on the **UI thread**. It optionally **freezes** the canvas (`Document.Enabled=False`) while capturing to avoid recomputation/layout flicker. It returns both the **full graph** and the **ordered consolidated** view.

```python
# Build full graph -> consolidate -> order (DAG) -> annotate stages

def get_context(options=None):
    try:
        doc = ghenv.Component.OnPingDocument()
        if not doc:
            return {"status": "error", "result": "No active Grasshopper document"}

        options = options or {}
        freeze = bool(options.get("freezeCanvas", True))
        include_params_nodes = True  # full export by design in step 1

        canvas = gh.Instances.ActiveCanvas
        if canvas and freeze:
            canvas.Document.Enabled = False

        graph = {}
        try:
            # Enumerate all objects (full context)
            for obj in doc.Objects:
                if isinstance(obj, Grasshopper.Kernel.IGH_Component):
                    comp_info = _get_component_info(obj)
                    if comp_info:
                        graph[comp_info["instanceGuid"]] = comp_info
                    # outputs
                    try:
                        for o in list(obj.Params.Output):
                            pinfo = get_param_info(o, comp_info["instanceGuid"])
                            if pinfo: graph[pinfo["instanceGuid"]] = pinfo
                    except: pass
                    # inputs
                    try:
                        for i in list(obj.Params.Input):
                            pinfo = get_param_info(i, comp_info["instanceGuid"])
                            if pinfo:
                                if comp_info and comp_info["instanceGuid"] not in pinfo["targets"]:
                                    pinfo["targets"].append(comp_info["instanceGuid"])
                                graph[pinfo["instanceGuid"]] = pinfo
                    except: pass
                elif isinstance(obj, IGH_Param) and include_params_nodes:
                    pinfo = get_param_info(obj)
                    if pinfo: graph[pinfo["instanceGuid"]] = pinfo

            # Fill sources from targets for completeness
            try:
                for node_id, node in graph.items():
                    for tgt in node.get("targets", []) or []:
                        if tgt in graph:
                            srcs = graph[tgt].get("sources", [])
                            if node_id not in srcs:
                                srcs.append(node_id)
                                graph[tgt]["sources"] = srcs
            except: pass

            # Consolidate -> Order -> Annotate stages
            high = consolidate_graph_component_level(graph, {
                "include_io_signatures": True,
                "include_edges": True,
                "include_standalone_params": True,
                "text_mode": "nickOrName",
                "dedupe_channels": True
            })
            pos_map = _pos_map_from_full_graph(graph)
            high = order_high_level_dag(high, pos_map=pos_map)
            graph = _annotate_stages_into_full_graph(graph, high)

            return {
                "status": "success",
                "graph": graph,              # full (components + params), with stage
                "highLevel": high             # consolidated, ordered, with stages/meta
            }
        finally:
            if canvas and freeze:
                canvas.Document.Enabled = True
                canvas.Refresh()
    except Exception as e:
        sc.sticky["processing_error"] = "get_context failed: %s" % str(e)
        return {"status": "error", "result": "get_context failed: %s" % str(e)}
```

> **Note on freezing**: Using `canvas.Document.Enabled=False` prevents new solutions/layout during capture. We re-enable and refresh in `finally` to avoid leaving the canvas disabled. This is a common and safe pattern for short operations.

---

## 7) Wire into `process_command`

Add this branch. Like your other UI-bound ops, it uses `Rhino.RhinoApp.InvokeOnUiThread` and a temp sticky slot.

```python
# In process_command(command_data):
elif command_type in ("get_context", "getContext"):
    options = command_data.get("options", {})
    action = Action(lambda: sc.sticky.update({"__temp_result": get_context(options)}))
    Rhino.RhinoApp.InvokeOnUiThread(action)
    if "__temp_result" not in sc.sticky:
        raise RuntimeError("UI thread action for get_context did not complete or store result.")
    return sc.sticky.pop("__temp_result", {"status": "error", "result": "UI thread execution failed for get_context"})
```

**Client request shape** (from your web app):

```json
{
  "type": "get_context",
  "options": {
    "freezeCanvas": true
  }
}
```

**Response shape (summary):**

```json
{
  "status": "success",
  "graph": { "<guid>": { /* component or param with stage */ }, ... },
  "highLevel": {
    "components": [ {"id":"<guid>", "stage":0, /* io, counts, etc. */}, ... ],
    "edges": [ {"from":"<guid>", "to":"<guid>", "channels":[...]}, ... ],
    "meta": { "topo_order":[...], "stages":[[...],[...]], "max_stage":N }
  }
}
```

---

## 8) Performance & safety notes

* **UI thread time**: The capture runs on the UI thread so it sees a consistent state. For very large canvases, this might take noticeable time. The `freezeCanvas` option is meant to reduce flicker and recompute.
* **Big payloads**: Consider enabling gzip at the client/request layer (outside this script) if the graphs get large.
* **Privacy**: Script components include `code` in the full graph. If you don’t want to send code, remove that assignment in `_get_component_info` or add an option gate.

---

## 9) Next steps (not implemented here, for later iterations)

These are recommended follow-ups. They don’t change the `get_context` contract and can be layered on top.

1. **Markdown view** (server-side rendering or client-side):

   * Render the consolidated `highLevel` into **Markdown** grouped by `stage` (already have a renderer design). Great for AI prompts and human-readable summaries.
   * Optional XML-like rendering with `<Component/>`, `<Input/>`, `<Edge/>` tags for even more structure.

2. **Consolidated graph view** (client-facing):

   * Use `highLevel.components` + `highLevel.edges` for a succinct editor/overview.
   * Visualize by **stage buckets** to clarify potential parallelism.

3. **Query parameters & traversal APIs** (client-side or future server endpoints):

   * **By component UUID**: fetch a subgraph around a given component.

     * `depthUp` (predecessors) and `depthDown` (successors), e.g.: `?id=<guid>&depthUp=2&depthDown=3`.
     * Optionally limit by categories/kinds (e.g., scripts only).
   * **Multi-seed traversal**: Accept an array of component IDs; union of k-step neighborhoods up/down.
   * **Edge filtering**: by data type (`Number`, `Curve`, `Brep`), or channel label matches (regex on IO labels).
   * **Stage filters**: restrict to components within `[s_min, s_max]` or a specific stage set.
   * **Group/cluster awareness** (future): include GH groups if useful for hierarchical summaries.

4. **Lighter LODs** (optional server switch or client transform):

   * Provide `lod=tiny|mini|layout|perf` to shrink payloads while preserving `sources/targets`.

5. **Critical path analysis** (client or server):

   * Compute the longest path (by edge count or aggregated `computiationTime`) and mark components on the critical chain.

---

With these snippets added, your GH server can now **serve the full JSON context with DAG stages** and a **sorted high-level view** on demand, giving the front-end and AI layers a reliable, structured snapshot to work with.
