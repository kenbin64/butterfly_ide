# MANIFOLD-CENTRIC DIRECTIVES
- **Variable Naming:** Use coordinate-based nomenclature (e.g., `pt_x_y`, `surface_z`) instead of abstract names (e.g., `temp_var`).
- **File Structure:** - `/manifold-core/`: The math primitives.
    - `/manifests/`: Temporary files showing a specific "zoom" into the data.
- **Logic Rule:** To update a value, do not change a variable; shift the coordinate system.