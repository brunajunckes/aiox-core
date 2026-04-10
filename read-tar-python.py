#!/usr/bin/env python3
"""
Read files directly from tar.gz via HTTP streaming
No download, no extraction - just read what you need
"""

import tarfile
import urllib.request
import sys

GDRIVE_URL = "https://drive.usercontent.google.com/download?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK&export=download&confirm=t"

def list_contents():
    """List all files in archive"""
    print("📋 LISTING ARCHIVE CONTENTS...")
    print("=" * 60)

    try:
        with urllib.request.urlopen(GDRIVE_URL) as response:
            with tarfile.open(fileobj=response, mode='r|gz') as tar:
                print(f"{'File':<50} {'Size':>10}")
                print("-" * 60)

                file_count = 0
                igreja_count = 0

                for member in tar.getmembers():
                    file_count += 1

                    # Show Igreja files
                    if 'Igreja' in member.name or 'church' in member.name.lower():
                        igreja_count += 1
                        size = f"{member.size:,}" if member.isfile() else "DIR"
                        print(f"{member.name:<50} {size:>10}")

                    # Show sample of other files
                    if file_count <= 20 and 'Igreja' not in member.name:
                        size = f"{member.size:,}" if member.isfile() else "DIR"
                        print(f"{member.name:<50} {size:>10}")

                    if file_count % 1000 == 0:
                        print(f"[Processing {file_count} files...]")

                print("-" * 60)
                print(f"Total files: {file_count}")
                print(f"Igreja files: {igreja_count}")

    except Exception as e:
        print(f"❌ Error: {e}")
        print("Check that Google Drive quota is not exceeded")
        return False

    return True

def read_file(filepath):
    """Read specific file from archive"""
    print(f"📖 READING: {filepath}")
    print("=" * 60)

    try:
        with urllib.request.urlopen(GDRIVE_URL) as response:
            with tarfile.open(fileobj=response, mode='r|gz') as tar:
                for member in tar.getmembers():
                    if member.name == filepath:
                        if member.isfile():
                            f = tar.extractfile(member)
                            if f:
                                content = f.read().decode('utf-8', errors='ignore')
                                print(content[:5000])  # Show first 5000 chars
                                if len(content) > 5000:
                                    print(f"\n... [Truncated. Total size: {member.size} bytes]")
                                return True
                        else:
                            print(f"[{filepath} is a directory]")
                            return True

                print(f"❌ File not found: {filepath}")
                return False

    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return False

def find_files(pattern):
    """Find files matching pattern"""
    print(f"🔍 SEARCHING: {pattern}")
    print("=" * 60)

    try:
        matches = []
        with urllib.request.urlopen(GDRIVE_URL) as response:
            with tarfile.open(fileobj=response, mode='r|gz') as tar:
                for member in tar.getmembers():
                    if pattern.lower() in member.name.lower():
                        matches.append((member.name, member.size))

        if matches:
            print(f"Found {len(matches)} matching files:")
            for name, size in matches[:50]:  # Show first 50
                print(f"  {name} ({size:,} bytes)")
            if len(matches) > 50:
                print(f"  ... and {len(matches) - 50} more")
        else:
            print(f"No files matching '{pattern}'")

        return len(matches) > 0

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("╔════════════════════════════════════════════════════════╗")
    print("║  Direct TAR.GZ Stream Reading (Python Version)        ║")
    print("║  No download, no extraction - just read what you need  ║")
    print("╚════════════════════════════════════════════════════════╝")
    print()

    if len(sys.argv) < 2:
        print("📋 Listing archive contents (this may take a minute)...")
        print()
        list_contents()

        print()
        print("💡 USAGE:")
        print(f"  {sys.argv[0]} list                    # List all files")
        print(f"  {sys.argv[0]} read <filepath>         # Read specific file")
        print(f"  {sys.argv[0]} find <pattern>          # Find files matching pattern")
        print()
        print("Examples:")
        print(f"  {sys.argv[0]} read Igreja/package.json")
        print(f"  {sys.argv[0]} find package.json")
        print(f"  {sys.argv[0]} find .ts")

    elif sys.argv[1] == "list":
        list_contents()

    elif sys.argv[1] == "read" and len(sys.argv) > 2:
        read_file(sys.argv[2])

    elif sys.argv[1] == "find" and len(sys.argv) > 2:
        find_files(sys.argv[2])

    else:
        print("❌ Unknown command or missing argument")
        print(f"Usage: {sys.argv[0]} [list|read <file>|find <pattern>]")

if __name__ == "__main__":
    main()
