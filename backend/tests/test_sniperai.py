"""SniperAI backend API tests"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestHealth:
    """Health and stats endpoints"""

    def test_root(self, client):
        r = client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert "status" in data
        print(f"Root: {data}")

    def test_stats(self, client):
        r = client.get(f"{BASE_URL}/api/stats")
        assert r.status_code == 200
        data = r.json()
        assert "total_scans" in data
        assert "active_scans" in data
        assert "total_findings" in data
        assert "critical_findings" in data
        assert "attack_plans" in data
        assert "sniper_available" in data
        print(f"Stats: {data}")


class TestScans:
    """Scan CRUD and demo mode"""

    def test_list_scans(self, client):
        r = client.get(f"{BASE_URL}/api/scans")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} scans")

    def test_create_scan_demo(self, client):
        payload = {"target": "TEST_target.example.com", "mode": "normal", "workspace": "TEST_workspace"}
        r = client.post(f"{BASE_URL}/api/scans", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert data["target"] == payload["target"]
        assert data["mode"] == payload["mode"]
        assert data["status"] in ["pending", "running"]
        print(f"Created scan: {data['id']}")
        # Store for other tests
        TestScans._created_scan_id = data["id"]

    def test_get_scan(self, client):
        if not hasattr(TestScans, "_created_scan_id"):
            pytest.skip("No scan created")
        r = client.get(f"{BASE_URL}/api/scans/{TestScans._created_scan_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == TestScans._created_scan_id

    def test_scan_output(self, client):
        if not hasattr(TestScans, "_created_scan_id"):
            pytest.skip("No scan created")
        time.sleep(2)  # Give demo scan a moment to start writing
        r = client.get(f"{BASE_URL}/api/scans/{TestScans._created_scan_id}/output")
        assert r.status_code == 200
        data = r.json()
        assert "lines" in data
        assert "status" in data
        print(f"Output lines: {len(data['lines'])}, status: {data['status']}")

    def test_scan_404(self, client):
        r = client.get(f"{BASE_URL}/api/scans/nonexistent-scan-id")
        assert r.status_code == 404

    def test_scan_findings(self, client):
        # Use existing scan if available
        scans = client.get(f"{BASE_URL}/api/scans").json()
        completed = [s for s in scans if s["status"] == "completed"]
        if not completed:
            pytest.skip("No completed scans available")
        scan_id = completed[0]["id"]
        r = client.get(f"{BASE_URL}/api/scans/{scan_id}/findings")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        print(f"Findings for scan {scan_id}: {len(r.json())}")

    def test_demo_scan_completes_with_findings(self, client):
        """Demo scan should complete and have 10 findings"""
        payload = {"target": "demo_findings_test.com", "mode": "normal"}
        r = client.post(f"{BASE_URL}/api/scans", json=payload)
        assert r.status_code == 200
        scan_id = r.json()["id"]
        # Wait up to 30s for completion
        for _ in range(15):
            time.sleep(2)
            scan = client.get(f"{BASE_URL}/api/scans/{scan_id}").json()
            if scan["status"] == "completed":
                break
        assert scan["status"] == "completed", f"Demo scan did not complete, status: {scan['status']}"
        findings = client.get(f"{BASE_URL}/api/scans/{scan_id}/findings").json()
        assert len(findings) == 10, f"Expected 10 findings, got {len(findings)}"
        print(f"Demo scan completed with {len(findings)} findings")


class TestFindings:
    """Findings endpoints"""

    def test_get_all_findings(self, client):
        r = client.get(f"{BASE_URL}/api/findings")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        print(f"Total findings: {len(r.json())}")

    def test_get_findings_by_severity(self, client):
        r = client.get(f"{BASE_URL}/api/findings?severity=CRITICAL")
        assert r.status_code == 200
        data = r.json()
        for f in data:
            assert f["severity"] == "CRITICAL"
        print(f"Critical findings: {len(data)}")


class TestAI:
    """AI recommendation endpoint"""

    def test_ai_recommend(self, client):
        payload = {"target": "testphp.vulnweb.com", "context": "web application"}
        r = client.post(f"{BASE_URL}/api/ai/recommend", json=payload)
        assert r.status_code == 200
        data = r.json()
        print(f"AI recommendation: {data}")

    def test_scan_analyze(self, client):
        """Test AI analysis on a completed scan"""
        scans = client.get(f"{BASE_URL}/api/scans").json()
        completed = [s for s in scans if s["status"] == "completed"]
        if not completed:
            pytest.skip("No completed scans available")
        scan_id = completed[0]["id"]
        r = client.post(f"{BASE_URL}/api/scans/{scan_id}/analyze")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "analyzing"
        print(f"Analysis started for scan {scan_id}: {data}")


class TestWorkspaces:
    """Workspaces endpoint"""

    def test_get_workspaces(self, client):
        r = client.get(f"{BASE_URL}/api/workspaces")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        print(f"Workspaces: {r.json()}")


class TestCleanup:
    """Cleanup test data"""

    def test_cleanup(self, client):
        scans = client.get(f"{BASE_URL}/api/scans").json()
        deleted = 0
        for s in scans:
            if "TEST_" in s.get("target", "") or "demo_findings_test" in s.get("target", ""):
                client.delete(f"{BASE_URL}/api/scans/{s['id']}")
                deleted += 1
        print(f"Cleaned up {deleted} test scans")
