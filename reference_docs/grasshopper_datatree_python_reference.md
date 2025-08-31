# Grasshopper DataTree Python Reference

## Table of Contents
1. [Overview and Best Practices](#overview-and-best-practices)
2. [Approach Comparison: treehelpers vs Direct DataTree](#approach-comparison)
3. [Required Imports](#required-imports)
4. [Type Detection Patterns](#type-detection-patterns)
5. [DataTree Construction and Path Creation](#datatree-construction-and-path-creation)
6. [Iteration Patterns](#iteration-patterns)
7. [Converting Between Trees and Lists](#converting-between-trees-and-lists)
8. [Performance Considerations](#performance-considerations)
9. [Common Patterns and Examples](#common-patterns-and-examples)
10. [Troubleshooting](#troubleshooting)

## Overview and Best Practices

According to McNeel's official documentation, the recommended approach is to **work with nested lists (lists of lists) when possible** and use `ghpythonlib.treehelpers` for conversions. This leverages Python's native data structures and provides cleaner, more maintainable code.

### McNeel's Official Recommendation
- Use `ghpythonlib.treehelpers` for simple conversions between DataTrees and nested lists
- Work with nested lists in Python whenever possible for cleaner code  
- Use direct `Grasshopper.DataTree` manipulation only when you need fine-grained control over paths and branches

## Approach Comparison

### 1. ghpythonlib.treehelpers (Recommended)

**Pros:**
- Simpler, more Pythonic code
- Leverages native Python list structures
- Maintained by McNeel with consistent API
- Better for most common use cases

**Cons:**  
- Limited control over specific path structures
- Requires consistent dimensional depth in data
- May need path remapping for complex structures

**Best for:** Standard tree operations, consistent data structures, cleaner code

### 2. Direct Grasshopper.DataTree Manipulation

**Pros:**
- Full control over path construction and tree structure
- Can handle complex, irregular tree structures
- Direct access to all DataTree methods and properties

**Cons:**
- More verbose, less Pythonic code
- Requires understanding of .NET DataTree internals
- More prone to errors with path handling

**Best for:** Complex tree manipulations, irregular structures, advanced tree operations

## Required Imports

### For treehelpers approach:
```python
import ghpythonlib.treehelpers as th
import Rhino.Geometry as rg  # if working with geometry
```

### For direct DataTree manipulation:
```python
import rhinoscriptsyntax as rs
import clr
clr.AddReference("Grasshopper")
import Grasshopper as gh
import Grasshopper.Kernel.Data.GH_Path as ghpath
import Grasshopper.DataTree as datatree
import System
import Rhino.Geometry as rg  # if working with geometry
```

## Type Detection Patterns

### Detecting Input Types
```python
# Method 1: Using hasattr (recommended)
def detect_input_type(input_data):
    if hasattr(input_data, 'BranchCount'):
        return "DataTree"
    elif isinstance(input_data, list):
        return "List"
    else:
        return "Item"

# Method 2: Using type checking
def process_input(input_data):
    if hasattr(input_data, 'BranchCount'):
        # Input is a DataTree
        for i in range(input_data.BranchCount):
            branch = input_data.Branch(i)
            path = input_data.Path(i)
            # Process branch...
    elif isinstance(input_data, list):
        # Input is a regular Python list
        for item in input_data:
            # Process item...
    else:
        # Input is a single item
        # Process single item...
```

### Getting Type Information
```python
# Get type name of items in a branch
for i in range(x.BranchCount):
    branchList = x.Branch(i)
    for j in range(branchList.Count):
        type_name = type(branchList[j]).__name__
        print("Type: " + type_name)
```

## DataTree Construction and Path Creation

### Creating Empty DataTrees
```python
# Method 1: Basic empty DataTree
point_tree = gh.DataTree[rg.Point3d]()
generic_tree = gh.DataTree[object]()

# Method 2: Copy from existing tree
new_tree = gh.DataTree[object](existing_tree)
```

### Creating and Using GH_Paths
```python
# Create paths with specific indices
path1 = ghpath(0, 0, 0)  # Creates path {0;0;0}
path2 = ghpath(2, 3)     # Creates path {2;3}
path3 = ghpath(1, 2, 3, 4)  # Creates path {1;2;3;4}

# Add data to specific paths
tree = datatree[System.Object]()
tree.Add(5, path1)                    # Add single item
tree.AddRange([0, 1, 2, 3], path2)    # Add multiple items
```

### Creating Trees from Nested Lists
```python
# Using treehelpers (recommended)
nested_list = [
    [1, 2, 3],      # Branch {0}
    [4, 5],         # Branch {1}  
    [6, 7, 8, 9]    # Branch {2}
]
tree = th.list_to_tree(nested_list, source=[0, 0])
```

## Iteration Patterns

### Iterating Through DataTree Branches
```python
# Method 1: Using range and BranchCount
for i in range(x.BranchCount):
    branch_list = x.Branch(i)
    branch_path = x.Path(i)
    
    print("Path: " + str(branch_path))
    for j in range(branch_list.Count):
        item = branch_list[j]
        print("  Item " + str(j) + ": " + str(item))

# Method 2: Using Paths property
for path in x.Paths:
    branch = x.Branch(path)
    print("Path: " + str(path))
    for item in branch:
        print("  Item: " + str(item))
```

### Processing Tree Structure
```python
def process_tree(tree):
    results = []
    for i in range(tree.BranchCount):
        branch = tree.Branch(i)
        path = tree.Path(i)
        
        # Process each item in branch
        branch_results = []
        for j in range(branch.Count):
            item = branch[j]
            # Apply your processing logic here
            processed_item = your_function(item)
            branch_results.append(processed_item)
        
        results.append(branch_results)
    
    return results
```

## Converting Between Trees and Lists

### Tree to List Conversion
```python
# Using treehelpers (recommended)
nested_list = th.tree_to_list(data_tree)

# Manual conversion
def tree_to_nested_list(tree):
    result = []
    for i in range(tree.BranchCount):
        branch = tree.Branch(i)
        branch_list = [branch[j] for j in range(branch.Count)]
        result.append(branch_list)
    return result
```

### List to Tree Conversion
```python
# Using treehelpers (recommended)
data_tree = th.list_to_tree(nested_list, source=[0, 0])

# Manual conversion
def nested_list_to_tree(nested_list, tree_type=object):
    tree = datatree[System.Object]()
    for i, branch_list in enumerate(nested_list):
        path = ghpath(i)
        tree.AddRange(branch_list, path)
    return tree
```

## Performance Considerations

### Best Practices for Performance
1. **Use treehelpers when possible** - More efficient than manual tree manipulation
2. **Avoid mixing data types** - Use separate trees for different data types
3. **Minimize conversions** - Convert once and work with the appropriate format
4. **Use appropriate types** - Specify correct generic types for DataTrees

### Memory Management
```python
# Efficient: Process data in-place when possible
def process_tree_efficient(tree):
    for i in range(tree.BranchCount):
        branch = tree.Branch(i)
        # Process items directly in branch
        
# Less efficient: Creating new collections unnecessarily
def process_tree_inefficient(tree):
    all_data = []
    for i in range(tree.BranchCount):
        branch = tree.Branch(i)
        for item in branch:
            all_data.append(item)  # Unnecessary intermediate list
```

### IronPython Considerations
- Be aware that IronPython.Runtime.List may cause compatibility issues
- Use empty C# components to convert when needed
- Consider type hints for better performance

## Common Patterns and Examples

### Pattern 1: Filter Tree by Condition
```python
def filter_tree_by_condition(input_tree, condition_func):
    if hasattr(input_tree, 'BranchCount'):
        # Working with DataTree
        nested_list = th.tree_to_list(input_tree)
        filtered_list = []
        
        for branch in nested_list:
            filtered_branch = [item for item in branch if condition_func(item)]
            filtered_list.append(filtered_branch)
        
        return th.list_to_tree(filtered_list, source=[0, 0])
    else:
        # Working with simple list
        return [item for item in input_tree if condition_func(item)]

# Usage
result = filter_tree_by_condition(input_data, lambda x: x > 0)
```

### Pattern 2: Transform Tree Structure
```python
def transform_tree(input_tree, transform_func):
    nested_list = th.tree_to_list(input_tree)
    transformed_list = []
    
    for branch in nested_list:
        transformed_branch = [transform_func(item) for item in branch]
        transformed_list.append(transformed_branch)
    
    return th.list_to_tree(transformed_list, source=[0, 0])

# Usage  
result = transform_tree(points_tree, lambda pt: pt * 2.0)
```

### Pattern 3: Merge Trees
```python
def merge_trees(tree1, tree2):
    list1 = th.tree_to_list(tree1)
    list2 = th.tree_to_list(tree2)
    
    merged_list = []
    max_branches = max(len(list1), len(list2))
    
    for i in range(max_branches):
        branch1 = list1[i] if i < len(list1) else []
        branch2 = list2[i] if i < len(list2) else []
        merged_branch = branch1 + branch2
        merged_list.append(merged_branch)
    
    return th.list_to_tree(merged_list, source=[0, 0])
```

### Pattern 4: Create Tree from Layers (Rhino)
```python
def create_tree_from_layers(layer_names):
    import Rhino
    
    layer_tree = [list() for _ in layer_names]
    
    for i, layer_name in enumerate(layer_names):
        objs = Rhino.RhinoDoc.ActiveDoc.Objects.FindByLayer(layer_name)
        
        if objs:
            geoms = [obj.Geometry for obj in objs]
            layer_tree[i].extend(geoms)
    
    return th.list_to_tree(layer_tree, source=[0, 0])
```

## Troubleshooting

### Common Issues and Solutions

1. **"Tree dimensions don't match" Error**
   - Ensure consistent dimensional depth in your nested lists
   - Use grafting or path remapping if needed
   - Check that all branches have the same nesting level

2. **IronPython.Runtime.List Output Issues**
   - Pass output through an empty C# component
   - Use proper type hints on inputs
   - Ensure proper conversion with treehelpers

3. **Path Construction Problems**
   ```python
   # Correct path construction
   path = ghpath(0, 1, 2)  # Creates {0;1;2}
   
   # Incorrect - don't pass lists
   # path = ghpath([0, 1, 2])  # This will fail
   ```

4. **Type Specification Issues**
   ```python
   # Correct - specify appropriate type
   tree = gh.DataTree[rg.Point3d]()  # For points
   tree = gh.DataTree[object]()      # For mixed types
   
   # Avoid generic DataTree without type specification
   ```

5. **Empty Branch Handling**
   ```python
   # Check for empty branches
   for i in range(tree.BranchCount):
       branch = tree.Branch(i)
       if branch.Count > 0:  # Only process non-empty branches
           # Process branch...
   ```

### Performance Troubleshooting
- Profile your code to identify bottlenecks
- Use treehelpers for standard operations
- Minimize type conversions
- Consider batch processing for large datasets

### Debugging Tips
```python
# Debug tree structure
def debug_tree_structure(tree):
    print("Tree has " + str(tree.BranchCount) + " branches")
    for i in range(tree.BranchCount):
        branch = tree.Branch(i)
        path = tree.Path(i)
        print("Branch " + str(i) + " - Path: " + str(path) + 
              " - Count: " + str(branch.Count))
        
        # Print first few items
        for j in range(min(3, branch.Count)):
            item = branch[j]
            print("  [" + str(j) + "]: " + str(type(item).__name__) + 
                  " = " + str(item))
```

---

*This reference is based on McNeel's official documentation and community best practices. Last updated: August 2025*