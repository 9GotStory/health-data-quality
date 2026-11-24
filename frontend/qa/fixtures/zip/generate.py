"""Regenerate the small, synthetic archives beside this script using Python 3."""
from pathlib import Path
from struct import pack_into
from zipfile import ZIP_BZIP2, ZIP_DEFLATED, ZIP_STORED, ZipFile, ZipInfo

fixtures = Path(__file__).parent


def add(archive, name, data, method=ZIP_STORED):
    entry = ZipInfo(name, (2026, 1, 1, 0, 0, 0))
    entry.create_system = 3
    archive.writestr(entry, data, compress_type=method)


with ZipFile(fixtures / "readable.zip", "w") as archive:
    add(archive, "PERSON.TXT", "PID|HOSPCODE9\nTEST-PERSON|")
    add(archive, "export.zip/", "")
    add(archive, "export.zip/hOmE.tXt", "HID\nTEST-HOME", ZIP_DEFLATED)
    add(archive, "POLICY.txt", "supplement")

# Change one stored payload byte after writing. The original CRC stays in both headers.
partial = fixtures / "partial.zip"
with ZipFile(partial, "w") as archive:
    add(archive, "PERSON.TXT", "PID\nVALID-CRC")
    add(archive, "HOME.txt", "HID\nTEST-HOME", ZIP_DEFLATED)
    add(archive, "export/ICF.txt", "DATE_SERRV")
    add(archive, "ICF.TXT", "DATE_SERRV")
    add(archive, "second/icf.txt", "VALID-CRC")
    add(archive, "supplement/POLICY.txt", "VALID-CRC")
partial.write_bytes(partial.read_bytes().replace(b"VALID-CRC", b"WRONG-CRC"))

with ZipFile(fixtures / "restricted.zip", "w") as archive:
    add(archive, "data/HOME.txt", "HID")
    add(archive, "PERSON.txt", "PID", ZIP_BZIP2)
    add(archive, "locked/DEATH.txt", "D_UPDATE")
    add(archive, "../CARD.txt", "HOSPCODE")
    link = ZipInfo("linked/ICF.txt")
    link.create_system = 3
    link.external_attr = 0o120777 << 16
    archive.writestr(link, "data/HOME.txt")
    add(archive, "nested.zip", (fixtures / "readable.zip").read_bytes())
    add(archive, "SERVICE.bin", "HOSPCODE")

# Mark DEATH as encrypted in both headers. Its contents must never be requested.
restricted = fixtures / "restricted.zip"
data = bytearray(restricted.read_bytes())
with ZipFile(restricted) as archive:
    local = archive.getinfo("locked/DEATH.txt").header_offset
    central = data.index(b"locked/DEATH.txt", archive.start_dir) - 46
pack_into("<H", data, local + 6, 1)
pack_into("<H", data, central + 8, 1)
restricted.write_bytes(data)
