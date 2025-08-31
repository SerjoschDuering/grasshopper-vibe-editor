# IronPython 2.7
import scriptcontext as sc
import clr
import socket
import threading
import json
import System
from System import Guid
from System.Drawing import RectangleF
import traceback # To log detailed errors
import time # Ensure time is imported
import re # Add import for regular expressions
import Rhino # <--- ADD THIS LINE

# Add References
clr.AddReference("System")
clr.AddReference("System.Drawing")
clr.AddReference("Grasshopper")

# Imports for Grasshopper types
import Grasshopper
import Grasshopper as gh
# Special components (e.g., Panel)
try:
    import Grasshopper.Kernel.Special as GHSpecial
except:
    GHSpecial = None
from Grasshopper.Kernel import GH_ParamAccess, IGH_Param
from Grasshopper.Kernel.Parameters import (
    Param_GenericObject, Param_String, Param_Number,
    Param_Integer, Param_Boolean, Param_Guid, Param_Point,
    Param_Vector, Param_Curve, Param_Surface, Param_Brep, Param_Mesh
)
# Import Action for Rhino.RhinoApp.InvokeOnUiThread
from System import Action

# --- Constants ---
HOST = "127.0.0.1"
PORT = 9998 # Use port 9998
COMPONENT_NICKNAME = "VibeCode GH Server" # Set a nickname for the component running this script

# --- Script Context Sticky Management ---
# Use scriptcontext.sticky as a persistent dictionary.
if "server_running" not in sc.sticky:
    sc.sticky["server_running"] = False
if "server_thread" not in sc.sticky:
    sc.sticky["server_thread"] = None
if "last_error" not in sc.sticky:
    sc.sticky["last_error"] = None
if "server_is_intended_to_run" not in sc.sticky:
    sc.sticky["server_is_intended_to_run"] = True

# --- JSON Encoding ---
class GHEncoder(json.JSONEncoder):
    """Custom JSON encoder for basic types, prevents errors with complex GH types."""
    def default(self, obj):
        if isinstance(obj, System.Guid):
            return str(obj)
        # Handle RectangleF for bounds
        try:
            if isinstance(obj, RectangleF):
                return {"x": float(obj.X), "y": float(obj.Y), "width": float(obj.Width), "height": float(obj.Height)}
        except:
            pass
        # Handle Point3d for positions (if Rhino.Geometry is available)
        try:
            import Rhino.Geometry as rg
            if isinstance(obj, rg.Point3d):
                return {"x": float(obj.X), "y": float(obj.Y), "z": float(obj.Z)}
        except:
            pass
        # Add other simple type conversions if needed, but avoid complex geometry
        # For most communication, we'll stick to strings, numbers, bools, lists, dicts
        try:
            return json.JSONEncoder.default(self, obj)
        except TypeError:
            return repr(obj) # Fallback to representation string

# --- Grasshopper Interaction Functions ---

def find_script_components(doc):
    """Finds all script components in the document."""
    script_components = []
    if not doc:
        return script_components
    for obj in doc.Objects:
        # Check if it's a component and likely a script component
        # (Checking for 'Code' attribute is a good indicator for GHPython)
        if isinstance(obj, Grasshopper.Kernel.IGH_Component) and hasattr(obj, "Code"):
             script_components.append(obj)
    return script_components

def get_selected_script_component_details():
    """
    Checks the current selection in Grasshopper.
    If exactly one script component is selected, returns its details.
    Otherwise, returns None or an indicator status.
    """
    doc = ghenv.Component.OnPingDocument()
    if not doc:
        return {"status": "error", "result": "No active Grasshopper document"}

    selected_script_components = []
    for obj in doc.Objects:
        if hasattr(obj, "Attributes") and obj.Attributes.Selected:
            # Check if it's a script component (e.g., GHPython)
            if isinstance(obj, Grasshopper.Kernel.IGH_Component) and hasattr(obj, "Code"):
                selected_script_components.append(obj)

    if len(selected_script_components) == 1:
        comp = selected_script_components[0]
        details = {
            "instance_guid": str(comp.InstanceGuid),
            "code": comp.Code if hasattr(comp, "Code") else "# Code attribute not found",
            "description": comp.Description,
            "param_definitions": format_params_for_webapp(comp)
        }
        return {"status": "success", "result": details}
    elif len(selected_script_components) == 0:
        return {"status": "none_selected", "result": "No script component selected"}
    else:
        return {"status": "multiple_selected", "result": "Multiple script components selected"}

def format_params_for_webapp(component):
    """Formats component parameters into the structure expected by the web app."""
    param_definitions = []
    if not hasattr(component, "Params"):
        return param_definitions

    # Process Inputs
    if hasattr(component.Params, "Input"):
        for p in component.Params.Input:
            param_info = {
                "type": "input",
                "name": p.NickName or p.Name, # Prefer NickName if available
                "description": p.Description,
                "access": get_access_string(p.Access),
                "typehint": get_typehint_string(p),
                "optional": p.Optional
            }
            param_definitions.append(param_info)

    # Process Outputs
    if hasattr(component.Params, "Output"):
        for p in component.Params.Output:
             # Outputs are simpler in the webapp's view
            param_info = {
                "type": "output",
                "name": p.NickName or p.Name,
                "description": p.Description
            }
            param_definitions.append(param_info)

    return param_definitions

def get_access_string(gh_param_access):
    """Converts GH_ParamAccess enum to string."""
    if gh_param_access == GH_ParamAccess.item:
        return "item"
    elif gh_param_access == GH_ParamAccess.tree:
        return "tree"
    else: # Default to list
        return "list"

def get_typehint_string(param):
    """Attempts to guess a simple typehint string from the parameter type."""
    # This provides a basic mapping. More specific hints might require checking param.TypeHint if available and reliable.
    if isinstance(param, Param_String): return "str"
    if isinstance(param, Param_Integer): return "int"
    if isinstance(param, Param_Number): return "float"
    if isinstance(param, Param_Boolean): return "bool"
    if isinstance(param, Param_Guid): return "guid"
    if isinstance(param, Param_Point): return "point"
    if isinstance(param, Param_Vector): return "vector"
    if isinstance(param, Param_Curve): return "curve"
    if isinstance(param, Param_Surface): return "surface"
    if isinstance(param, Param_Brep): return "brep"
    if isinstance(param, Param_Mesh): return "mesh"
    # Default for Param_GenericObject or others
    return "generic"

def get_access_enum(access_str):
    """Converts string ('item', 'list', 'tree') to GH_ParamAccess enum."""
    s = str(access_str).lower()
    if s == "item":
        return GH_ParamAccess.item
    elif s == "tree":
        return GH_ParamAccess.tree
    # Default to list for unknown or missing values
    return GH_ParamAccess.list

def create_gh_input_param(param_def):
    """Creates a Grasshopper input parameter from a definition dictionary."""
    name = param_def.get("name", "input")
    hint = param_def.get("typehint", "generic").lower()
    description = param_def.get("description", "Input parameter")
    access = get_access_enum(param_def.get("access", "list"))
    optional = param_def.get("optional", True)

    # Choose parameter type based on hint
    if hint == "str": param = Param_String()
    elif hint == "int": param = Param_Integer()
    elif hint == "float": param = Param_Number()
    elif hint == "bool": param = Param_Boolean()
    elif hint == "guid": param = Param_Guid()
    elif hint == "point": param = Param_Point()
    elif hint == "vector": param = Param_Vector()
    elif hint == "curve": param = Param_Curve()
    elif hint == "surface": param = Param_Surface()
    elif hint == "brep": param = Param_Brep()
    elif hint == "mesh": param = Param_Mesh()
    else: param = Param_GenericObject() # Default

    param.Name = name
    param.NickName = name
    param.Description = description
    param.Access = access
    param.Optional = optional
    # We don't set param.TypeHint explicitly here to allow users
    # to still change the type via the context menu if needed.
    # The component's behavior relies on the actual parameter *type*.

    return param

def create_gh_output_param(param_def):
    """Creates a Grasshopper output parameter from a definition dictionary."""
    name = param_def.get("name", "output")
    description = param_def.get("description", "Output parameter")

    # Outputs are typically generic unless specific typing is strictly needed
    param = Param_GenericObject()
    param.Name = name
    param.NickName = name
    param.Description = description

    return param

# --- Context Collection Helper Functions ---

def _rect_canvas_to_web(rect):
    """Convert canvas rectangle to web coordinates (inverts Y axis)."""
    try:
        return {"x": float(rect.X), "y": float(rect.Y * -1) - float(rect.Height), 
                "width": float(rect.Width), "height": float(rect.Height)}
    except:
        return None

def _pt_canvas_to_web(pt):
    """Convert canvas point to web coordinates (inverts Y axis)."""
    try:
        return {"x": float(pt.X), "y": float(pt.Y * -1), "z": 0}
    except:
        return None

def _collect_runtime_messages(obj):
    """Collect runtime messages from a component or parameter."""
    msgs = {"errors": [], "warnings": [], "remarks": []}
    try:
        # Try modern GH API first
        from Grasshopper.Kernel import GH_RuntimeMessageLevel
        if hasattr(obj, "RuntimeMessages"):
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
    except:
        # Fallback for older API
        try:
            if hasattr(obj, "RuntimeErrors"):
                for err in obj.RuntimeErrors:
                    msgs["errors"].append(str(err))
        except: pass
        try:
            if hasattr(obj, "RuntimeWarnings"):
                for warn in obj.RuntimeWarnings:
                    msgs["warnings"].append(str(warn))
        except: pass
    
    # Get bubble message if any
    try:
        bubble = getattr(obj, "Message", None)
        if bubble:
            msgs["remarks"].append(str(bubble))
    except: pass
    
    return msgs

def update_script_component_on_ui_thread(instance_guid_str, code, description, param_definitions):
    """
    Wrapper function to perform the component update on the UI thread.
    Handles finding the component, updating code, description, parameters,
    AND attempts to restore wire connections based on NickName.
    Uses a dummy parameter strategy for robust parameter updates.
    Returns a dictionary indicating success or failure.
    """
    result = {"status": "error", "result": "Update failed"} # Default result
    comp = None
    canvas = None
    doc = None # Make doc accessible in finally

    # --- Storage for old connections ---
    old_input_connections = {} # { nickName: [source_guid1, source_guid2, ...], ... }
    old_output_connections = {} # { nickName: [recipient_guid1, recipient_guid2, ...], ... }
    connection_restore_log = [] # Log messages about connection restoration

    try:
        doc = ghenv.Component.OnPingDocument()
        if not doc:
            return {"status": "error", "result": "No active Grasshopper document"}

        target_instance_guid = Guid.Parse(instance_guid_str) # Assuming valid GUID format based on previous checks
        comp = doc.FindObject(target_instance_guid, False)
        if not comp or not (isinstance(comp, Grasshopper.Kernel.IGH_Component) and hasattr(comp, "Code")):
             return {"status": "error", "result": "Target component (GUID: {}) not found or not a script component.".format(instance_guid_str)}

        # === Step 0: Record Existing Connections BEFORE modifications ===
        try:
            if hasattr(comp.Params, "Input"):
                for p_in in list(comp.Params.Input): # Iterate copy
                    if p_in.NickName and p_in.Sources: # Check if sources exist
                        old_input_connections[p_in.NickName] = [source.InstanceGuid for source in p_in.Sources if source] # Store source GUIDs

            if hasattr(comp.Params, "Output"):
                 for p_out in list(comp.Params.Output): # Iterate copy
                     if p_out.NickName and p_out.Recipients: # Check if recipients exist
                         old_output_connections[p_out.NickName] = [recipient.InstanceGuid for recipient in p_out.Recipients if recipient] # Store recipient GUIDs
            connection_restore_log.append("Recorded {} input and {} output connection sets.".format(len(old_input_connections), len(old_output_connections)))
        except Exception as e:
            connection_restore_log.append("Warning: Error recording connections: {}".format(e))
            old_input_connections = {} # Clear on error to prevent issues later
            old_output_connections = {}

        # --- Perform Updates ---
        code_updated = False
        params_updated = False
        description_updated = False

        canvas = gh.Instances.ActiveCanvas
        if canvas: canvas.Document.Enabled = False

        # Lists to store the *new* parameter objects created
        new_input_params = []
        new_output_params = []

        try:
            # === Step 1: Update Parameters ===
            if param_definitions is not None:
                dummy_input = None
                dummy_output = None
                try:
                    # Dummy Parameter Strategy (as before)
                    dummy_input_def = {"name": "__dummy_in__", "description": "Temp"}
                    dummy_output_def = {"name": "__dummy_out__", "description": "Temp"}
                    dummy_input = create_gh_input_param(dummy_input_def)
                    dummy_output = create_gh_output_param(dummy_output_def)
                    comp.Params.RegisterInputParam(dummy_input)
                    comp.Params.RegisterOutputParam(dummy_output)

                    inputs_to_remove = [p for p in comp.Params.Input if p.InstanceGuid != dummy_input.InstanceGuid]
                    outputs_to_remove = [p for p in comp.Params.Output if p.InstanceGuid != dummy_output.InstanceGuid]
                    for p in inputs_to_remove: comp.Params.UnregisterInputParameter(p)
                    for p in outputs_to_remove: comp.Params.UnregisterOutputParameter(p)

                    # Add New & Store References
                    for p_def in param_definitions:
                        param_type = p_def.get("type", "").lower()
                        if param_type == "input":
                            new_param = create_gh_input_param(p_def)
                            comp.Params.RegisterInputParam(new_param)
                            new_input_params.append(new_param) # Store new input param obj
                        elif param_type == "output":
                            new_param = create_gh_output_param(p_def)
                            comp.Params.RegisterOutputParam(new_param)
                            new_output_params.append(new_param) # Store new output param obj

                    # Ensure Default Output & Store Reference
                    current_output_names = [p.Name for p in comp.Params.Output]
                    if "output" not in current_output_names and "__dummy_out__" not in current_output_names:
                         default_out = create_gh_output_param({"name": "output", "description": "Default output"})
                         comp.Params.RegisterOutputParam(default_out)
                         new_output_params.append(default_out) # Store new default output obj

                    # Remove Dummies
                    if dummy_input: comp.Params.UnregisterInputParameter(dummy_input)
                    if dummy_output: comp.Params.UnregisterOutputParameter(dummy_output)

                    params_updated = True
                except Exception as e:
                    sc.sticky["last_error"] = "Parameter update failed: {}".format(e)
                    try:
                        if dummy_input and dummy_input in comp.Params.Input: comp.Params.UnregisterInputParameter(dummy_input)
                        if dummy_output and dummy_output in comp.Params.Output: comp.Params.UnregisterOutputParameter(dummy_output)
                    except: pass

            # === Step 2: Restore Connections ===
            if params_updated and doc: # Only if params were changed and doc exists
                connection_restore_log.append("Attempting connection restoration...")
                # Restore Input Connections
                for new_p_in in new_input_params:
                    if new_p_in.NickName in old_input_connections:
                        source_guids = old_input_connections[new_p_in.NickName]
                        sources_found = 0
                        for source_guid in source_guids:
                            source_param = doc.FindObject(source_guid, False)
                            if isinstance(source_param, IGH_Param): # Check if it's a valid parameter
                                try:
                                    new_p_in.AddSource(source_param)
                                    sources_found += 1
                                except Exception as conn_e:
                                     connection_restore_log.append(" Error connecting Input '{}' to Source {}: {}".format(new_p_in.NickName, source_guid, conn_e))
                        if sources_found > 0:
                             connection_restore_log.append(" Restored {} source(s) for Input '{}'".format(sources_found, new_p_in.NickName))

                # Restore Output Connections
                for new_p_out in new_output_params:
                    if new_p_out.NickName in old_output_connections:
                        recipient_guids = old_output_connections[new_p_out.NickName]
                        recipients_found = 0
                        for recipient_guid in recipient_guids:
                            recipient_param = doc.FindObject(recipient_guid, False)
                            if isinstance(recipient_param, IGH_Param): # Check if it's a valid parameter
                                try:
                                    # Connect FROM new_p_out TO recipient_param
                                    recipient_param.AddSource(new_p_out)
                                    recipients_found += 1
                                except Exception as conn_e:
                                    connection_restore_log.append(" Error connecting Output '{}' to Recipient {}: {}".format(new_p_out.NickName, recipient_guid, conn_e))
                        if recipients_found > 0:
                             connection_restore_log.append(" Restored {} recipient(s) for Output '{}'".format(recipients_found, new_p_out.NickName))
                sc.sticky["connection_log"] = "\n".join(connection_restore_log) # Store log

            # === Step 3: Update Code / Description (PRINT REMOVED) ===
            if code is not None:
                try:
                    comp.Code = str(code)
                    code_updated = True
                except Exception as e:
                    sc.sticky["last_error"] = "Code update failed: {}".format(e)
            if description is not None:
                try:
                    comp.Description = str(description)
                    description_updated = True
                except Exception as e:
                    sc.sticky["last_error"] = "Description update failed: {}".format(e)

            # === Step 4: Finalize layout and solution expiry ===
            if params_updated: # Only call if params actually changed
                comp.Params.OnParametersChanged()
            if hasattr(comp, "Attributes"): comp.Attributes.ExpireLayout()
            comp.ExpireSolution(True)

            result = {
                "status": "success",
                "result": {
                    "code_updated": code_updated,
                    "params_updated": params_updated,
                    "description_updated": description_updated,
                    "component_type": type(comp).__name__,
                    "connection_log": connection_restore_log # Include log in result
                }
            }

        except Exception as e:
            result = {"status": "error", "result": "Error during component update process: {}".format(e)}
            sc.sticky["last_error"] = result["result"]
        finally:
            # Re-enable canvas, refresh
            if canvas: canvas.Document.Enabled = True
            if comp and hasattr(comp, "Attributes"): comp.Attributes.ExpireLayout()
            if canvas: canvas.Refresh()

    except Exception as e:
        # Catch outer errors (finding component, parsing GUID)
        result = {"status": "error", "result": "Outer error updating component: {}".format(e)}
        sc.sticky["last_error"] = result["result"]

    return result

# --- Selection Function ---

def get_selected_components():
    """
    Returns GUIDs of currently selected components in GH canvas
    """
    try:
        doc = ghenv.Component.OnPingDocument()
        if not doc:
            return {"status": "error", "result": "No active Grasshopper document"}
        
        selected_guids = []
        
        # Get all selected objects
        for obj in doc.SelectedObjects():
            # Check if it's a component (not just a parameter or other object)
            if isinstance(obj, gh.Kernel.IGH_Component):
                selected_guids.append(str(obj.InstanceGuid))
        
        return {
            "status": "success",
            "selectedGuids": selected_guids,
            "count": len(selected_guids)
        }
    except Exception as e:
        return {"status": "error", "result": "Failed to get selection: {}".format(str(e))}

# --- Context Collection Function ---

def get_context(options=None):
    """
    Collect raw Grasshopper graph data - minimal processing, just data collection.
    Returns components, parameters, and connections as simple lists.
    """
    try:
        doc = ghenv.Component.OnPingDocument()
        if not doc:
            return {"status": "error", "result": "No active Grasshopper document"}
        
        options = options or {}
        freeze = bool(options.get("freezeCanvas", False))
        
        canvas = gh.Instances.ActiveCanvas
        if canvas and freeze:
            canvas.Document.Enabled = False
        
        try:
            components = []
            params = []  # Keep for standalone params
            connections = []
            
            # Collect all objects in the document
            for obj in doc.Objects:
                try:
                    if isinstance(obj, Grasshopper.Kernel.IGH_Component):
                        # Collect component info
                        comp_info = {
                            "instanceGuid": str(obj.InstanceGuid),
                            "name": getattr(obj, "Name", ""),
                            "nickName": getattr(obj, "NickName", ""),
                            "description": getattr(obj, "Description", ""),
                            "category": getattr(obj, "Category", None),
                            "subCategory": getattr(obj, "SubCategory", None),
                            "kind": "component",
                            "isScript": bool(hasattr(obj, "Code")),
                            "scriptContent": None,
                            "scriptLanguage": None,
                            "locked": bool(getattr(obj, "Locked", False)),
                            "hidden": bool(getattr(obj, "Hidden", False)),
                            "runtime": _collect_runtime_messages(obj),
                            "inputs": [],  # Nested input parameters
                            "outputs": []  # Nested output parameters
                        }
                        
                        # Add bounds if available
                        if hasattr(obj, "Attributes") and hasattr(obj.Attributes, "Bounds"):
                            comp_info["bounds"] = _rect_canvas_to_web(obj.Attributes.Bounds)
                        if hasattr(obj, "Attributes") and hasattr(obj.Attributes, "Pivot"):
                            comp_info["pivot"] = _pt_canvas_to_web(obj.Attributes.Pivot)
                        
                        # Add computation time if available
                        if hasattr(obj, "ProcessorTime"):
                            comp_info["computationTime"] = float(obj.ProcessorTime.Milliseconds)
                        
                        # Extract script content if it's a script component
                        if comp_info["isScript"]:
                            # Check if detailed mode is requested (for now, always include if available)
                            include_script = options.get("includeScriptContent", True) if options else True
                            if include_script:
                                try:
                                    if hasattr(obj, "Code"):
                                        comp_info["scriptContent"] = str(obj.Code)
                                        
                                        # Try to detect the language
                                        type_name = str(type(obj).__name__)
                                        if "GhPython" in type_name or "Python" in type_name:
                                            comp_info["scriptLanguage"] = "Python"
                                        elif "C#" in type_name or "CSharp" in type_name:
                                            comp_info["scriptLanguage"] = "C#"
                                        elif "VB" in type_name:
                                            comp_info["scriptLanguage"] = "VB"
                                        else:
                                            comp_info["scriptLanguage"] = "Unknown"
                                except:
                                    pass  # Silently fail if we can't get script content
                        
                        # Collect input parameters - now nested within component
                        if hasattr(obj.Params, "Input"):
                            for p_in in obj.Params.Input:
                                param_info = {
                                    "instanceGuid": str(p_in.InstanceGuid),
                                    "componentGuid": str(obj.InstanceGuid),
                                    "name": p_in.Name,
                                    "nickName": p_in.NickName,
                                    "kind": "input",
                                    "dataType": get_typehint_string(p_in),
                                    "access": get_access_string(p_in.Access),
                                    "optional": p_in.Optional,
                                    "hasData": bool(hasattr(p_in, "DataType") and p_in.DataType != gh.Kernel.GH_ParamData.void)
                                }
                                comp_info["inputs"].append(param_info)
                                
                                # Also add to flat params list for connection tracking
                                params.append(param_info)
                                
                                # Collect connections from this input
                                if hasattr(p_in, "Sources"):
                                    for source in p_in.Sources:
                                        if source:
                                            connections.append({
                                                "from": str(source.InstanceGuid),
                                                "to": str(p_in.InstanceGuid),
                                                "type": "wire"
                                            })
                        
                        # Collect output parameters - now nested within component
                        if hasattr(obj.Params, "Output"):
                            for p_out in obj.Params.Output:
                                param_info = {
                                    "instanceGuid": str(p_out.InstanceGuid),
                                    "componentGuid": str(obj.InstanceGuid),
                                    "name": p_out.Name,
                                    "nickName": p_out.NickName,
                                    "kind": "output",
                                    "dataType": get_typehint_string(p_out)
                                }
                                comp_info["outputs"].append(param_info)
                                
                                # Also add to flat params list for connection tracking
                                params.append(param_info)
                                
                                # Collect connections from this output
                                if hasattr(p_out, "Recipients"):
                                    for recipient in p_out.Recipients:
                                        if recipient:
                                            connections.append({
                                                "from": str(p_out.InstanceGuid),
                                                "to": str(recipient.InstanceGuid),
                                                "type": "wire"
                                            })
                        
                        components.append(comp_info)
                    
                    elif isinstance(obj, IGH_Param):
                        # Standalone parameter (not part of a component)
                        param_info = {
                            "instanceGuid": str(obj.InstanceGuid),
                            "componentGuid": None,
                            "name": obj.Name,
                            "nickName": obj.NickName,
                            "kind": "standalone",
                            "dataType": get_typehint_string(obj)
                        }
                        # If it's a Panel, attempt to capture its (user) text content
                        try:
                            if GHSpecial is not None and isinstance(obj, GHSpecial.GH_Panel):
                                param_info["isPanel"] = True
                                try:
                                    # User-entered text in the panel
                                    param_info["panelContent"] = str(getattr(obj, "UserText", ""))
                                except:
                                    pass
                                # Useful Panel display flags (best-effort)
                                try:
                                    param_info["multiline"] = bool(getattr(obj, "Multiline", False))
                                except:
                                    pass
                                try:
                                    param_info["wrap"] = bool(getattr(obj, "Wrap", False))
                                except:
                                    pass
                            else:
                                param_info["isPanel"] = False
                        except:
                            # Never fail context collection on panel detection
                            param_info["isPanel"] = False
                        
                        # Add bounds if available
                        if hasattr(obj, "Attributes") and hasattr(obj.Attributes, "Bounds"):
                            param_info["bounds"] = _rect_canvas_to_web(obj.Attributes.Bounds)
                        
                        params.append(param_info)
                        
                        # Collect connections
                        if hasattr(obj, "Sources"):
                            for source in obj.Sources:
                                if source:
                                    connections.append({
                                        "from": str(source.InstanceGuid),
                                        "to": str(obj.InstanceGuid),
                                        "type": "wire"
                                    })
                        
                        if hasattr(obj, "Recipients"):
                            for recipient in obj.Recipients:
                                if recipient:
                                    connections.append({
                                        "from": str(obj.InstanceGuid),
                                        "to": str(recipient.InstanceGuid),
                                        "type": "wire"
                                    })
                
                except Exception as obj_err:
                    # Skip objects that cause errors
                    pass
            
            return {
                "status": "success",
                "components": components,
                "params": params,
                "connections": connections,
                "meta": {
                    "componentCount": len(components),
                    "paramCount": len(params),
                    "connectionCount": len(connections)
                }
            }
            
        finally:
            if canvas and freeze:
                canvas.Document.Enabled = True
                if hasattr(canvas, "Refresh"):
                    canvas.Refresh()
    
    except Exception as e:
        sc.sticky["processing_error"] = "get_context failed: {}".format(str(e))
        return {"status": "error", "result": "get_context failed: {}".format(str(e))}


# --- HTTP Server Logic ---

def socket_server_thread():
    """Background thread function to run the HTTP server."""
    host = '127.0.0.1'
    port = 9998
    server_socket = None

    try:
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_socket.bind((host, port))
        server_socket.listen(5)
        sc.sticky["server_status"] = "Server listening on port {}".format(port)
        sc.sticky.pop("server_thread_error", None)

        while sc.sticky.get("run_server", True):
            conn = None
            addr = None
            try:
                # Use blocking accept initially, but with a timeout for the loop
                server_socket.settimeout(1.0)
                conn, addr = server_socket.accept()
                conn.settimeout(10.0) # Set timeout for operations on this connection
                sc.sticky["last_connection_addr"] = str(addr)

                # --- Read Request Headers ---
                headers_raw = ""
                while True:
                    try:
                        line = conn.recv(1024) # Read line by line (approx)
                        if not line: # Connection closed
                            headers_raw = "" # Reset if closed before headers end
                            break
                        headers_raw += line
                        if "\r\n\r\n" in headers_raw:
                            break
                        # Safety break for excessively long headers
                        if len(headers_raw) > 8192:
                             raise ValueError("Headers too large")
                    except socket.timeout:
                        raise socket.timeout("Timeout reading request headers")
                    except Exception as header_err:
                         raise ValueError("Error reading headers: {}".format(header_err))

                if not headers_raw or "\r\n\r\n" not in headers_raw:
                     # Connection closed or malformed before headers complete
                     if conn: conn.close()
                     continue # Go back to accept

                header_part, body_start = headers_raw.split("\r\n\r\n", 1)
                header_lines = header_part.split("\r\n")
                if not header_lines:
                    raise ValueError("Malformed headers received")

                # --- Parse Request Line and Headers ---
                request_line = header_lines[0]
                request_line_parts = request_line.split(' ')
                if len(request_line_parts) < 2:
                     raise ValueError("Malformed request line: {}".format(request_line))
                method = request_line_parts[0].upper()
                path = request_line_parts[1]

                headers = {}
                for line in header_lines[1:]:
                    header_parts = line.split(':', 1)
                    if len(header_parts) == 2:
                        headers[header_parts[0].strip().lower()] = header_parts[1].strip()

                # --- Read Request Body (if Content-Length specified) ---
                content_length = int(headers.get('content-length', 0))
                body = body_start # Include any part of the body received with headers
                
                # Read remaining body bytes based on Content-Length
                while len(body) < content_length:
                    bytes_to_read = min(4096, content_length - len(body))
                    try:
                        chunk = conn.recv(bytes_to_read)
                        if not chunk:
                            raise IOError("Connection closed unexpectedly while reading body")
                        body += chunk
                    except socket.timeout:
                        raise socket.timeout("Timeout reading request body")
                    except Exception as body_err:
                         raise ValueError("Error reading body: {}".format(body_err))
                
                sc.sticky["last_request_len"] = len(body) # Log actual body length read

                # --- Health Check (lightweight GET) ---
                if method == "GET" and path == "/healthz":
                    response = "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\nOK"
                    conn.sendall(response)
                    continue

                # --- Process Request ---
                response = handle_request(method, headers, body) # Pass parsed parts
                conn.sendall(response)

            except socket.timeout:
                 error_msg = "Socket timeout during connection handling with {}".format(addr if addr else 'unknown')
                 sc.sticky["server_thread_error"] = error_msg
                 # Try sending timeout response if possible
                 try:
                     timeout_response = "HTTP/1.1 408 Request Timeout\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                     if conn: conn.sendall(timeout_response)
                 except: pass # Ignore errors sending timeout response
            except Exception as e:
                tb_str = traceback.format_exc()
                error_msg = "Error handling connection from {}: {}\n{}".format(addr if addr else 'unknown', e, tb_str)
                sc.sticky["server_thread_error"] = error_msg
                # Try sending internal server error response
                try:
                    error_response_body = json.dumps({"status": "error", "result": "Internal server error during connection handling."})
                    error_response = "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{}".format(len(error_response_body), error_response_body)
                    if conn: conn.sendall(error_response)
                except Exception as send_err:
                    sc.sticky["server_thread_error"] = str(sc.sticky.get("server_thread_error", "")) + "\nAdditionally failed to send error response: {}".format(send_err)
            finally:
                if conn:
                    conn.close()

        # End of while loop (server stopping)
        sc.sticky["server_status"] = "Server stopped."

    except Exception as e:
        tb_str = traceback.format_exc()
        error_msg = "FATAL: Socket server thread failed: {}\n{}".format(e, tb_str)
        sc.sticky["server_thread_error"] = error_msg
        sc.sticky["server_status"] = "Server stopped due to error."
    finally:
        if server_socket:
            server_socket.close()
        current_status = sc.sticky.get("server_status", "")
        if "listening" in current_status: # Update only if it thought it was running
            sc.sticky["server_status"] = "Server stopped."


# --- HTTP Server Logic ---

def handle_request(method, headers, body):
    """
    Handles parsed HTTP request components (method, headers, body).
    Handles CORS preflight (OPTIONS) and processes POST commands.
    Returns the HTTP response string.
    """
    response_body = ""
    try:
        # --- Handle OPTIONS Preflight Request ---
        if method == "OPTIONS":
            # Send CORS preflight response
            cors_headers = {
                "Access-Control-Allow-Origin": "*", # Or specify origin for tighter security
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400",
                "Content-Length": "0"
            }
            response_lines = ["HTTP/1.1 200 OK"]
            for key, value in cors_headers.items():
                response_lines.append("{}: {}".format(key, value))
            response_lines.append("Connection: close")
            response = "\r\n".join(response_lines) + "\r\n\r\n"
            sc.sticky["server_status"] = "Handled OPTIONS request"
            return response

        # --- Handle POST Request ---
        elif method == "POST":
            # Ensure content type is JSON if body exists
            content_type = headers.get('content-type', '').lower()
            if body and 'application/json' not in content_type:
                 raise ValueError("Invalid Content-Type for POST: '{}'. Expected 'application/json'.".format(content_type))

            if not body:
                 raise ValueError("No body found in POST request")

            json_body_str = body.strip('\x00').strip()
            if not json_body_str:
                raise ValueError("Empty body after stripping in POST request")

            try:
                command_data = json.loads(json_body_str)
            except ValueError as json_e:
                 raise ValueError("Invalid JSON received: {} - Body start: '{}...'".format(json_e, json_body_str[:100]))

            result = process_command(command_data) # process_command handles its own errors via sticky
            response_body = json.dumps(result, cls=GHEncoder) # Use GHEncoder
            status_line = "HTTP/1.1 200 OK"

            post_headers = {
                 "Content-Type": "application/json",
                 "Content-Length": str(len(response_body)),
                 "Access-Control-Allow-Origin": "*",
                 "Connection": "close"
             }
            response_lines = [status_line]
            for key, value in post_headers.items():
                response_lines.append("{}: {}".format(key, value))

            response = "\r\n".join(response_lines) + "\r\n\r\n" + response_body
            return response

        # --- Handle Other Methods ---
        else:
             raise ValueError("Unsupported HTTP method: {}".format(method))

    except Exception as e:
        tb_str = traceback.format_exc()
        error_msg = "Error processing request (Method: {}): {}\n{}".format(method, e, tb_str)
        sc.sticky["request_processing_error"] = error_msg # Log error

        # Prepare error response
        result = {"status": "error", "result": "Server error processing request. Check GH component output."}
        response_body = json.dumps(result)
        error_status = "HTTP/1.1 500 Internal Server Error" if not isinstance(e, ValueError) else "HTTP/1.1 400 Bad Request"
        error_headers = {
            "Content-Type": "application/json",
            "Content-Length": str(len(response_body)),
            "Access-Control-Allow-Origin": "*", # Allow CORS for error response too
            "Connection": "close"
        }
        response_lines = [error_status]
        for key, value in error_headers.items():
            response_lines.append("{}: {}".format(key, value))

        response = "\r\n".join(response_lines) + "\r\n\r\n" + response_body
        return response


# Modify process_command to avoid printing errors directly
def process_command(command_data):
    """Process a command and return the result dictionary. Uses sticky for errors."""
    command_type = command_data.get("type")
    # Clear previous processing errors before starting
    sc.sticky.pop("processing_error", None)
    sc.sticky.pop("last_error", None) # Clear specific update error too

    try:
        if command_type == "get_selected_script_component":
            # Execute on UI thread
            action = Action(lambda: sc.sticky.update({"__temp_result": get_selected_script_component_details()}))
            Rhino.RhinoApp.InvokeOnUiThread(action)
            # Check if the action itself failed to put anything in sticky (might happen if UI thread is blocked/crashes instantly)
            if "__temp_result" not in sc.sticky:
                 raise RuntimeError("UI thread action for get_selected_script_component did not complete or store result.")
            result = sc.sticky.pop("__temp_result", {"status": "error", "result": "UI thread execution failed for get_selected"})
            return result

        elif command_type == "update_script":
            instance_guid = command_data.get("instance_guid")
            code = command_data.get("code")
            description = command_data.get("description")
            param_definitions = command_data.get("param_definitions")

            if not instance_guid:
                 # Log error to sticky
                 sc.sticky["processing_error"] = "Missing 'instance_guid' for update_script."
                 return {"status": "error", "result": "Missing 'instance_guid'."}

            # Execute the update on the UI thread
            action = Action(lambda: sc.sticky.update({"__temp_result": update_script_component_on_ui_thread(instance_guid, code, description, param_definitions)}))
            Rhino.RhinoApp.InvokeOnUiThread(action)
            # Check if the action itself failed to put anything in sticky
            if "__temp_result" not in sc.sticky:
                 raise RuntimeError("UI thread action for update_script did not complete or store result.")
            result = sc.sticky.pop("__temp_result", {"status": "error", "result": "UI thread execution failed for update"})

            # Check for specific error logged during the update by update_script_component_on_ui_thread
            last_err = sc.sticky.get("last_error")
            if last_err and result.get("status") == "error":
                 result["result"] = "{}; Specific Error: {}".format(result.get("result", "Update error"), last_err)
            elif last_err:
                 result["warning"] = "Update success with issues: {}".format(last_err)

            return result
        
        elif command_type == "get_context":
            # Get context data from Grasshopper
            options = command_data.get("options", {})
            
            # Execute on UI thread
            action = Action(lambda: sc.sticky.update({"__temp_result": get_context(options)}))
            Rhino.RhinoApp.InvokeOnUiThread(action)
            
            # Check if the action completed
            if "__temp_result" not in sc.sticky:
                raise RuntimeError("UI thread action for get_context did not complete or store result.")
            
            result = sc.sticky.pop("__temp_result", {"status": "error", "result": "UI thread execution failed for get_context"})
            return result
        
        elif command_type == "get_selection":
            # Get currently selected components in Grasshopper
            # Execute on UI thread
            action = Action(lambda: sc.sticky.update({"__temp_result": get_selected_components()}))
            Rhino.RhinoApp.InvokeOnUiThread(action)
            
            # Check if the action completed
            if "__temp_result" not in sc.sticky:
                raise RuntimeError("UI thread action for get_selection did not complete or store result.")
            
            result = sc.sticky.pop("__temp_result", {"status": "error", "result": "UI thread execution failed for get_selection"})
            return result

        else:
             # Log error to sticky
             sc.sticky["processing_error"] = "Unknown command type: {}".format(command_type)
             return {"status": "error", "result": "Unknown command type: {}".format(command_type)}

    # --- MODIFIED EXCEPTION HANDLING ---
    except Exception as e:
         tb_str = traceback.format_exc()
         # Log full traceback to sticky (for GH component bubble)
         error_msg_full = "Error in process_command ({}): {}\n{}".format(command_type, e, tb_str)
         sc.sticky["processing_error"] = error_msg_full

         # Create a more informative error message for the web app response
         error_detail_for_web = "Failed during '{}': {}".format(command_type, str(e))
         # Optionally add first line of traceback? Be cautious with length.
         # tb_lines = tb_str.splitlines()
         # if len(tb_lines) > 0: error_detail_for_web += " ({})".format(tb_lines[-1].strip())

         return {"status": "error", "result": error_detail_for_web} # Return specific error message
    # --- END MODIFIED EXCEPTION HANDLING ---


# --- Main Script Logic (runs in GHPython component) ---

# === Required Input: Add a boolean input named 'RunServer' to your component ===
# Persistent intent: default to last intended state (defaults to True on first run)
run_server_toggle = bool(locals().get("RunServer", sc.sticky.get("server_is_intended_to_run", True)))
explicit_toggle_present = "RunServer" in locals()

# === State Management using sc.sticky ===
server_was_intended_to_run = sc.sticky.get("server_is_intended_to_run", False)
server_thread_active = sc.sticky.get("socket_server_started", False) # Checks if thread object was created

# --- Start/Stop Logic ---
if explicit_toggle_present and run_server_toggle and not server_was_intended_to_run:
    # --- START SERVER ---
    # Check if a thread might still exist but wasn't flagged (e.g., after script reload)
    old_thread = sc.sticky.get("server_thread_obj")
    if old_thread and old_thread.isAlive():
         print("Warning: Previous server thread might still be active. Attempting to signal stop first.")
         sc.sticky["run_server"] = False # Signal old thread to stop
         time.sleep(1.2) # Give it a moment to potentially stop

    print("Toggle ON: Starting socket server thread...")
    try:
        # Ensure sticky is clean before start
        sc.sticky.pop("server_thread_error", None)
        sc.sticky.pop("request_processing_error", None)
        sc.sticky.pop("processing_error", None)
        sc.sticky.pop("last_error", None)
        sc.sticky.pop("server_status", None) # Clear old status

        sc.sticky["run_server"] = True # Flag for the thread loop
        thread = threading.Thread(target=socket_server_thread)
        thread.daemon = True
        thread.start()
        sc.sticky["socket_server_started"] = True # Mark thread object as created
        sc.sticky["server_thread_obj"] = thread # Store the thread object itself
        sc.sticky["server_is_intended_to_run"] = True # Mark desired state

        # Allow brief moment for server thread to update status
        time.sleep(0.1)
        print("Server thread initiated.")

    except Exception as start_err:
         print("ERROR starting server thread: {}".format(start_err))
         sc.sticky["socket_server_started"] = False
         sc.sticky["server_is_intended_to_run"] = False
         sc.sticky["server_thread_obj"] = None
         sc.sticky["server_status"] = "Failed to start"


elif explicit_toggle_present and (not run_server_toggle) and server_was_intended_to_run:
    # --- STOP SERVER ---
    print("Toggle OFF: Signaling server thread to stop...")
    sc.sticky["run_server"] = False # Signal thread to exit its loop
    sc.sticky["server_is_intended_to_run"] = False # Mark desired state
    # Note: Thread stops itself. We don't explicitly join() here to avoid blocking GH.
    # The thread status will update via sticky["server_status"] when it exits.
    # We keep 'socket_server_started' True until a new thread is started,
    # indicating a thread *was* running, even if stopping. Clear thread object ref.
    sc.sticky["server_thread_obj"] = None


# --- Status Reporting and Error Checking (Runs every time component updates) ---

# Watchdog: auto-restart if intended to run and thread died
try:
    if sc.sticky.get("server_is_intended_to_run", False):
        t = sc.sticky.get("server_thread_obj")
        thread_dead = (t is None) or (hasattr(t, "isAlive") and (not t.isAlive()))
        if thread_dead:
            try:
                sc.sticky["run_server"] = True
                thread = threading.Thread(target=socket_server_thread)
                thread.daemon = True
                thread.start()
                sc.sticky["socket_server_started"] = True
                sc.sticky["server_thread_obj"] = thread
                sc.sticky["server_status"] = "Server listening on port {}".format(PORT)
            except Exception as _auto_e:
                sc.sticky["server_status"] = "Failed to auto-restart: {}".format(_auto_e)
except Exception as _wd_err:
    # Do not fail the component due to watchdog errors; just note it
    sc.sticky["server_thread_error"] = str(_wd_err)

# Check for errors logged by the background thread(s) and print from main thread
server_error = sc.sticky.pop("server_thread_error", None)
if server_error:
    ghenv.Component.AddRuntimeMessage(Grasshopper.Kernel.GH_RuntimeMessageLevel.Error, "Server Thread Error:\n" + str(server_error)[:500]) # Show in component bubble
    # print("! SERVER THREAD ERROR:\n{}".format(server_error)) # Optional: also print to Rhino console

req_proc_error = sc.sticky.pop("request_processing_error", None)
if req_proc_error:
    ghenv.Component.AddRuntimeMessage(Grasshopper.Kernel.GH_RuntimeMessageLevel.Warning, "Request Handling Error:\n" + str(req_proc_error)[:500])
    # print("! REQUEST PROCESSING ERROR:\n{}".format(req_proc_error))

cmd_proc_error = sc.sticky.pop("processing_error", None)
if cmd_proc_error:
    ghenv.Component.AddRuntimeMessage(Grasshopper.Kernel.GH_RuntimeMessageLevel.Warning, "Command Processing Error:\n" + str(cmd_proc_error)[:500])
    # print("! COMMAND PROCESSING ERROR:\n{}".format(cmd_proc_error))

# Get current status from sticky (updated by the server thread)
server_status_message = sc.sticky.get("server_status", "Server Off")

# Display current status
# Use component message bubble for primary status feedback
ghenv.Component.Message = server_status_message

# Optional: Set component nickname based on status
if "listening" in server_status_message.lower():
    ghenv.Component.NickName = COMPONENT_NICKNAME + " (Running)"
elif "error" in server_status_message.lower():
     ghenv.Component.NickName = COMPONENT_NICKNAME + " (Error)"
else:
    ghenv.Component.NickName = COMPONENT_NICKNAME + " (Stopped)"


# Optional: Output the status string to an output parameter named 'status'
# status = server_status_message

# --- Debug Output ---
# === Required Output: Add a text output named 'debug_output' to your component ===
debug_info_list = ["--- sc.sticky contents ({}) ---".format(time.strftime("%H:%M:%S"))]

# --- CORRECTED CHECK ---
# Check if the 'sc' module has the 'sticky' attribute and if it's dictionary-like
if hasattr(sc, "sticky"):
    try:
        # Create a sorted list of items for consistent order
        # Use items() for Python 2.7 compatibility with IronPython
        sticky_items = sc.sticky.items() # Get items first
        sorted_items = sorted(sticky_items)

        if not sorted_items:
            debug_info_list.append("(sticky is empty)")

        for key, value in sorted_items:
             # Avoid printing the raw thread object, show relevant info instead
             if key == "server_thread_obj" and isinstance(value, threading.Thread):
                 thread_state = "Alive" if value.isAlive() else "Not Alive"
                 value_str = "<Thread ID: {}, State: {}>".format(value.ident, thread_state)
             else:
                 # Convert value to string representation and truncate if too long
                 try:
                     value_str = repr(value) # Use repr for clearer type info
                 except Exception as repr_err:
                      value_str = "[Error getting repr: {}]".format(repr_err)

                 if len(value_str) > 200: # Limit length for readability
                     value_str = value_str[:200] + "..."

             debug_info_list.append(u"{}: {}".format(key, value_str)) # Use unicode literals

    except AttributeError:
         # Catch if sc.sticky is not dict-like (e.g., None) after hasattr check passes
         debug_info_list.append("(sc.sticky exists but is not dictionary-like)")
    except Exception as debug_err:
        debug_info_list.append("! Error reading sticky: {}".format(debug_err))
else:
    debug_info_list.append("(Attribute 'sticky' not found on 'sc')")
# --- END CORRECTED CHECK ---

# Assign the formatted string list joined by newlines to the debug_output variable.
# Grasshopper will automatically pass this to the output parameter named 'debug_output'.
debug_output = "\n".join(debug_info_list)
