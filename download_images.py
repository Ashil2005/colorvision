import urllib.request
import os

os.makedirs('assets/plates', exist_ok=True)

# The correct base URL from the HTML source
base_url = "https://www.colorlitelens.com/images/Ishihara/Ishihara_{:02d}.jpg"

for i in range(1, 13):
    url = base_url.format(i)
    filename = f"assets/plates/Ishihara_{i:02d}.jpg"
    print(f"Downloading {url} to {filename}...")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            with open(filename, 'wb') as f:
                f.write(response.read())
        print(f"Success: {filename}")
    except Exception as e:
        print(f"Failed to download {filename}: {e}")

# Also download the demo plate 00
try:
    url_00 = "https://www.colorlitelens.com/images/Ishihara/Ishihara_00.jpg"
    filename_00 = "assets/plates/Ishihara_00.jpg"
    req = urllib.request.Request(url_00, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        with open(filename_00, 'wb') as f:
            f.write(response.read())
    print("Success: assets/plates/Ishihara_00.jpg")
except Exception as e:
    print(f"Failed to download Ishihara_00.jpg: {e}")
