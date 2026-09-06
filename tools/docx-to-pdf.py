"""
제출용 Word(.docx) → PDF 변환

대회 제출물은 PDF다. 이 PC에 한글(HWP)이 없고 MS Word 가 있으므로 Word 로 내보낸다.

    python tools/docx-to-pdf.py

Word 를 백그라운드로 띄워 각 파일을 열고 PDF 로 저장한 뒤 닫는다.
변환 후 페이지 수를 세어 결과를 보고한다.
"""

from __future__ import annotations

import pathlib
import sys

try:
    import win32com.client as win32
except ImportError:
    sys.exit("pywin32 가 필요합니다:  python -m pip install pywin32")

WD_FORMAT_PDF = 17
OUT_DIR = pathlib.Path("제출")


def convert_all() -> list[tuple[pathlib.Path, int]]:
    targets = sorted(OUT_DIR.glob("*.docx"))
    if not targets:
        sys.exit("제출/ 에 docx 가 없습니다. 먼저 tools/md-to-docx.py 를 실행하세요.")

    word = win32.Dispatch("Word.Application")
    word.Visible = False
    word.DisplayAlerts = 0
    done: list[tuple[pathlib.Path, int]] = []
    try:
        for src in targets:
            pdf = src.with_suffix(".pdf")
            # 결과 PDF 를 뷰어로 열어둔 채 다시 돌리는 일이 잦다. 잠긴 파일에 바로
            # 쓰면 Word 가 통째로 실패하므로, 임시 이름으로 내보낸 뒤 교체한다.
            tmp = pdf.with_name(pdf.stem + ".__new__.pdf")
            tmp.unlink(missing_ok=True)
            doc = word.Documents.Open(str(src.resolve()), ReadOnly=True)
            try:
                # 페이지 수 집계를 위해 한 번 재계산한다
                doc.Repaginate()
                pages = doc.ComputeStatistics(2)  # wdStatisticPages
                doc.SaveAs(str(tmp.resolve()), FileFormat=WD_FORMAT_PDF)
            finally:
                doc.Close(False)
            try:
                tmp.replace(pdf)
                done.append((pdf, pages))
            except OSError:
                print(f"  ! {pdf.name} 이(가) 열려 있어 교체하지 못했습니다.")
                print(f"    새 파일: {tmp.name}. 뷰어를 닫고 다시 실행하면 정리됩니다.")
                done.append((tmp, pages))
    finally:
        word.Quit()
    return done


if __name__ == "__main__":
    for pdf, pages in convert_all():
        print(f"  {pdf}  ({pages}쪽, {pdf.stat().st_size:,} bytes)")
