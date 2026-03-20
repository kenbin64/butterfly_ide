import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

def run_visualization():
    # 1. Define the Manifold Surface (z = xy)
    x = np.linspace(-5, 5, 100)
    y = np.linspace(-5, 5, 100)
    X, Y = np.meshgrid(x, y)
    Z = X * Y  # The Saddle Primitive

    fig = plt.figure(figsize=(10, 7))
    ax = fig.add_subplot(111, projection='3d')

    # Plot the surface
    surf = ax.plot_surface(X, Y, Z, cmap='viridis', alpha=0.8)

    # 2. Manifest a "Holon" (A specific point of data)
    point_x, point_y = 2, 3
    point_z = point_x * point_y
    ax.scatter([point_x], [point_y], [point_z], color='red', s=100, label='Manifested Point')

    # 3. Apply 90-degree Rotation (The State Shift)
    # Rotation: (-y, x)
    rot_x, rot_y = -point_y, point_x
    rot_z = rot_x * rot_y
    ax.scatter([rot_x], [rot_y], [rot_z], color='cyan', s=100, label='90° Rotated State')

    # Formatting the "Geometric Reality"
    ax.set_title('GoldenStack: z=xy Manifold Visualization')
    ax.set_xlabel('X Axis')
    ax.set_ylabel('Y Axis')
    ax.set_zlabel('Z (Gleaned Data)')
    ax.legend()
    
    plt.show()

if __name__ == "__main__":
    run_visualization()