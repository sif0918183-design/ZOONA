import glob

api_files = [
    'api/admin-aliexpress.js',
    'api/admin-auth.js',
    'api/admin-products.js',
    'api/feedback.js',
    'api/international.js',
    'api/orders.js',
    'api/products.js',
    'api/saveToken.js',
    'api/sendNotification.js',
    'api/upload-image.js'
]
target_origin = 'https://zoona-git-feat-add-product-hide-option-3ddb43-sifians-projects.vercel.app'

missing = []
for file_path in api_files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    if target_origin not in content:
        missing.append(file_path)

if missing:
    print(f"FAILED: The following files do not contain the target origin:\n{missing}")
    exit(1)
else:
    print(f"SUCCESS: All {len(api_files)} restricted API handlers include the target origin {target_origin}")
