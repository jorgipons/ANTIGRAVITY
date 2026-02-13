# Script to remove corrupted EditMatchView code (lines 595-743)
with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Keep lines before 595 and after 743
new_lines = lines[:594] + lines[743:]

with open('index.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Removed lines 595-743. File now has {len(new_lines)} lines instead of {len(lines)}")
