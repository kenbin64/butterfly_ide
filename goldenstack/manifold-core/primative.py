import numpy as np

class Manifold:
    """The Root Manifold Generator (z = xy)"""
    
    @staticmethod
    def glean(x, y, scale=1.0):
        """Derives the Z-attribute (data) from the surface."""
        return (x * y) * scale

    @staticmethod
    def rotate_90(coords):
        """
        Applies a 90-degree helix rotation.
        In Dimensional Programming, this is a 'State Shift'.
        """
        x, y, z = coords
        # Standard 90-degree rotation around Z-axis
        return np.array([-y, x, z])

    @staticmethod
    def manifest_holon(parent_coords, depth=1):
        """Recursive manifestation: Every point contains the whole."""
        z = Manifold.glean(parent_coords[0], parent_coords[1])
        parts = []
        if depth > 0:
            # Manifest 4 sub-points (parts) within this point (whole)
            for i in range(4):
                rotated = Manifold.rotate_90([parent_coords[0], parent_coords[1], z])
                parts.append(Manifold.manifest_holon(rotated[:2] / 2, depth - 1))
        return {"point": [parent_coords[0], parent_coords[1], z], "parts": parts}