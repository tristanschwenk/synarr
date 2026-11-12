import importlib.util
import json
import os
import shutil
import tempfile
import unittest
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.join(HERE, "fixtures")

spec = importlib.util.spec_from_file_location("configure_apps", os.path.join(HERE, "configure-apps.py"))
configure_apps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(configure_apps)


def make_base_dir():
    """Lay out fixtures the way docker-config/ looks on the server."""
    base = tempfile.mkdtemp()
    cfg = os.path.join(base, "docker-config")
    for app in ("radarr", "sonarr", "prowlarr"):
        os.makedirs(os.path.join(cfg, app))
        shutil.copy(os.path.join(FIXTURES, "config.xml"), os.path.join(cfg, app, "config.xml"))
    os.makedirs(os.path.join(cfg, "bazarr", "config"))
    shutil.copy(os.path.join(FIXTURES, "bazarr-config.yaml"), os.path.join(cfg, "bazarr", "config", "config.yaml"))
    os.makedirs(os.path.join(cfg, "seerr"))
    shutil.copy(os.path.join(FIXTURES, "seerr-settings.json"), os.path.join(cfg, "seerr", "settings.json"))
    return base


class ConfigureAppsTest(unittest.TestCase):
    def setUp(self):
        self.base = make_base_dir()
        self.cfg = os.path.join(self.base, "docker-config")

    def tearDown(self):
        shutil.rmtree(self.base)

    def test_xml_sets_url_base_and_external_auth(self):
        path = os.path.join(self.cfg, "radarr", "config.xml")
        configure_apps.update_xml_config(path, "/radarr")
        root = ET.parse(path).getroot()
        self.assertEqual(root.findtext("UrlBase"), "/radarr")
        self.assertEqual(root.findtext("AuthenticationMethod"), "External")
        self.assertEqual(root.findtext("ApiKey"), "fixture-api-key")
        self.assertEqual(root.findtext("Port"), "7878")

    def test_bazarr_yaml_sets_three_base_urls_only(self):
        path = os.path.join(self.cfg, "bazarr", "config", "config.yaml")
        before = open(path).read().splitlines()
        configure_apps.update_bazarr_yaml(path)
        after = open(path).read().splitlines()
        self.assertEqual(len(before), len(after))
        changed = {i: (b, a) for i, (b, a) in enumerate(zip(before, after)) if b != a}
        self.assertEqual(after[2], "  base_url: /bazarr")    # general
        self.assertEqual(after[9], "  base_url: /radarr")    # radarr
        self.assertEqual(after[14], "  base_url: /sonarr")   # sonarr
        self.assertEqual(sorted(changed), [2, 9, 14])        # plex and subsarr untouched

    def test_seerr_sets_base_urls_and_keeps_hosts(self):
        path = os.path.join(self.cfg, "seerr", "settings.json")
        configure_apps.update_seerr_settings(path)
        data = json.load(open(path))
        self.assertEqual(data["radarr"][0]["baseUrl"], "/radarr")
        self.assertEqual(data["sonarr"][0]["baseUrl"], "/sonarr")
        self.assertEqual(data["radarr"][0]["hostname"], "100.82.243.124")
        self.assertEqual(data["sonarr"][0]["apiKey"], "fixture-sonarr")
        self.assertTrue(open(path).read().startswith('{\n "clientId"'))  # Seerr's 1-space indent

    def test_script_is_idempotent(self):
        def snapshot():
            out = {}
            for dirpath, _, files in os.walk(self.cfg):
                for f in files:
                    p = os.path.join(dirpath, f)
                    out[p] = open(p).read()
            return out

        configure_apps.main([ "--base-dir", self.base])
        first = snapshot()
        configure_apps.main(["--base-dir", self.base])
        self.assertEqual(first, snapshot())


if __name__ == "__main__":
    unittest.main()
