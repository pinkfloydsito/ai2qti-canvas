from cairosvg import svg2png
from PIL import Image
import os


def convert_svg_to_ico(svg_path, ico_path):
    """Convert SVG to Windows ICO format"""
    temp_png = "temp_icon.png"

    try:
        # Render SVG to a high-res PNG
        svg2png(url=svg_path, write_to=temp_png, output_width=1024, output_height=1024)

        # Open the image and convert to ICO with multiple sizes
        img = Image.open(temp_png)
        img.save(
            ico_path,
            format="ICO",
            sizes=[
                (16, 16),
                (24, 24),
                (32, 32),
                (48, 48),
                (64, 64),
                (128, 128),
                (256, 256),
                (512, 512),
            ],
        )

        print(f"Successfully created ICO file at {ico_path}")
        return True

    except Exception as e:
        print(f"Error creating ICO: {str(e)}")
        return False

    finally:
        if os.path.exists(temp_png):
            os.remove(temp_png)


# Usage
convert_svg_to_ico("logo.svg", "logo.ico")
