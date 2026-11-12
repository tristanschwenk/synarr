#!/usr/bin/env python3
import os
import xml.etree.ElementTree as ET
import argparse
import json
import re

def update_xml_config(filepath, url_base):
    print(f"Configuring {filepath}...")
    dir_name = os.path.dirname(filepath)
    if not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)
    
    if os.path.exists(filepath):
        try:
            tree = ET.parse(filepath)
            root = tree.getroot()
        except Exception as e:
            print(f"Error parsing XML {filepath}, creating new config. Error: {e}")
            root = ET.Element("Config")
            tree = ET.ElementTree(root)
    else:
        root = ET.Element("Config")
        tree = ET.ElementTree(root)

    # Set UrlBase
    url_base_el = root.find("UrlBase")
    if url_base_el is None:
        url_base_el = ET.SubElement(root, "UrlBase")
    url_base_el.text = url_base

    # Set AuthenticationMethod
    auth_method_el = root.find("AuthenticationMethod")
    if auth_method_el is None:
        auth_method_el = ET.SubElement(root, "AuthenticationMethod")
    auth_method_el.text = "External"

    # Set AuthenticationRequired
    auth_req_el = root.find("AuthenticationRequired")
    if auth_req_el is None:
        auth_req_el = ET.SubElement(root, "AuthenticationRequired")
    auth_req_el.text = "Enabled"

    if hasattr(ET, 'indent'):
        ET.indent(tree, space="  ", level=0)

    try:
        tree.write(filepath, encoding="utf-8", xml_declaration=True)
        print(f"Successfully configured {filepath}")
    except Exception as e:
        print(f"Failed to write config {filepath}: {e}")

def update_bazarr_yaml(filepath):
    """Set Bazarr's own base URL and the base URLs it uses to reach Radarr and Sonarr.

    Line-based edit so every other line of config.yaml stays byte-for-byte (no PyYAML needed).
    """
    if not os.path.exists(filepath):
        print(f"Skipping {filepath}: not found (start Bazarr once to create it)")
        return
    wanted = {"general": "/bazarr", "radarr": "/radarr", "sonarr": "/sonarr"}
    section = None
    lines = open(filepath).read().split("\n")
    for i, line in enumerate(lines):
        top = re.match(r"^([A-Za-z0-9_]+):\s*$", line)
        if top:
            section = top.group(1)
        elif section in wanted and re.match(r"^  base_url:", line):
            lines[i] = f"  base_url: {wanted[section]}"
    with open(filepath, "w") as f:
        f.write("\n".join(lines))
    print(f"Successfully configured {filepath}")


def update_seerr_settings(filepath):
    """Point Seerr's Radarr and Sonarr connections at their new URL bases."""
    if not os.path.exists(filepath):
        print(f"Skipping {filepath}: not found (set up Seerr first)")
        return
    with open(filepath) as f:
        data = json.load(f)
    for key, base in (("radarr", "/radarr"), ("sonarr", "/sonarr")):
        for server in data.get(key, []):
            server["baseUrl"] = base
    with open(filepath, "w") as f:
        json.dump(data, f, indent=1)
    print(f"Successfully configured {filepath}")


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Set URL bases for the Synarr tools. Stop radarr, sonarr, prowlarr, bazarr and seerr first."
    )
    parser.add_argument(
        "--base-dir",
        default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        help="Repo folder that contains docker-config/ (default: this script's repo)",
    )
    args = parser.parse_args(argv)
    cfg = os.path.join(args.base_dir, "docker-config")

    update_xml_config(os.path.join(cfg, "radarr", "config.xml"), "/radarr")
    update_xml_config(os.path.join(cfg, "sonarr", "config.xml"), "/sonarr")
    update_xml_config(os.path.join(cfg, "prowlarr", "config.xml"), "/prowlarr")
    update_bazarr_yaml(os.path.join(cfg, "bazarr", "config", "config.yaml"))
    update_seerr_settings(os.path.join(cfg, "seerr", "settings.json"))


if __name__ == "__main__":
    main()
