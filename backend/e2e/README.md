# End-to-end flow scripts

Drive the running API as a real user would (client -> advisor -> reviewer -> release -> PDF).
`flow_client.py` fills the client's 9 questionnaire steps from the data-gathering sheet (rebased to 2026) and uploads documents.
`flow_staff.py` calculates, overrides risk, runs a scenario, generates/approves/releases a plan and downloads the PDFs.

    E2E_CLIENT_EMAIL=you@example.com E2E_CLIENT_PASSWORD=... python3 flow_client.py
    E2E_CLIENT_EMAIL=you@example.com E2E_CLIENT_PASSWORD=... E2E_OUT=/tmp/out/ python3 flow_staff.py

Demo staff accounts must exist (`npm run seed`); the staff password is read from `backend/.env`.
