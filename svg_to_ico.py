from cairosvg import svg2png
from PIL import Image
import os


def convert_svg_to_ico(svg_path, ico_path, size=(256, 256)):
    png_path = "temp.png"
    svg2png(
        url=svg_path, write_to=png_path, output_width=size[0], output_height=size[1]
    )

    # Step 2: Convert PNG to ICO
    img = Image.open(png_path)
    img.save(ico_path, format="ICO", sizes=[size])

    # Clean up temporary PNG file
    os.remove(png_path)
    print(f"ICO file saved as {ico_path}")


svg_file = "logo.svg"
ico_file = "log.ico"
convert_svg_to_ico(svg_file, ico_file)
