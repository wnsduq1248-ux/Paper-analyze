"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type Props = {
  file: File;
};

type NoteType = "word" | "concept" | "figure";

type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Highlight = {
  id: number;
  page: number;
  type: NoteType;
  text: string;
  rects: HighlightRect[];
};

type Note = {
  id: number;
  highlightId: number;
  text: string;
  memo: string;
  type: NoteType;
  page: number;
};

type PendingSelection = {
  text: string;
  page: number;
  rects: HighlightRect[];
};

type FigureDrag = {
  page: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

export default function PdfViewer({ file }: Props) {
  const [numPages, setNumPages] = useState(0);

  const [selectedText, setSelectedText] = useState("");

  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);

  const [menuPosition, setMenuPosition] = useState({
    x: 0,
    y: 0,
  });

  const [showMemoBox, setShowMemoBox] =
    useState(false);

  const [memoText, setMemoText] = useState("");

  const [currentType, setCurrentType] =
    useState<NoteType>("word");

  const [viewType, setViewType] =
    useState<NoteType>("word");

  const [notes, setNotes] =
    useState<Note[]>([]);

  const [highlights, setHighlights] =
    useState<Highlight[]>([]);

  const [pendingHighlightId, setPendingHighlightId] =
    useState<number | null>(null);

  const [loaded, setLoaded] =
    useState(false);

  // ==============================
  // 피규어 선택 모드
  // ==============================

  const [figureMode, setFigureMode] =
    useState(false);

  const [figureDrag, setFigureDrag] =
    useState<FigureDrag | null>(null);

  // ==============================
  // PDF별 저장 키
  // ==============================

  const storageKey =
    "paper-note-" +
    file.name +
    "-" +
    file.size +
    "-" +
    file.lastModified;

  // ==============================
  // 저장된 데이터 불러오기
  // ==============================

  useEffect(() => {
    setLoaded(false);

    const saved =
      localStorage.getItem(storageKey);

    if (!saved) {
      setNotes([]);
      setHighlights([]);
      setLoaded(true);
      return;
    }

    try {
      const data = JSON.parse(saved);

      setNotes(data.notes ?? []);
      setHighlights(data.highlights ?? []);
    } catch {
      setNotes([]);
      setHighlights([]);
    }

    setLoaded(true);
  }, [storageKey]);

  // ==============================
  // 변경될 때마다 자동 저장
  // ==============================

  useEffect(() => {
    if (!loaded) return;

    const data = {
      notes,
      highlights,
    };

    localStorage.setItem(
      storageKey,
      JSON.stringify(data)
    );
  }, [
    notes,
    highlights,
    storageKey,
    loaded,
  ]);

  // ==============================
  // 선택 초기화
  // ==============================

  const clearSelection = () => {
    window
      .getSelection()
      ?.removeAllRanges();

    setSelectedText("");
    setPendingSelection(null);
  };

  // ==============================
  // PDF 텍스트 선택
  // ==============================

  const handleMouseUp = () => {
    // 피규어 선택 모드일 때는
    // 텍스트 선택 기능 막기
    if (figureMode) return;

    if (showMemoBox) return;

    const selection =
      window.getSelection();

    if (
      !selection ||
      selection.rangeCount === 0
    ) {
      return;
    }

    const text =
      selection.toString().trim();

    if (!text) return;

    const range =
      selection.getRangeAt(0);

    let startElement: Element | null = null;

    if (
      range.startContainer.nodeType ===
      Node.TEXT_NODE
    ) {
      startElement =
        range.startContainer.parentElement;
    } else if (
      range.startContainer instanceof Element
    ) {
      startElement =
        range.startContainer;
    }

    if (!startElement) return;

    const pageWrapper =
      startElement.closest(
        "[data-paper-page]"
      );

    if (
      !(pageWrapper instanceof HTMLElement)
    ) {
      return;
    }

    const page = Number(
      pageWrapper.dataset.paperPage
    );

    if (!page) return;

    let endElement: Element | null = null;

    if (
      range.endContainer.nodeType ===
      Node.TEXT_NODE
    ) {
      endElement =
        range.endContainer.parentElement;
    } else if (
      range.endContainer instanceof Element
    ) {
      endElement =
        range.endContainer;
    }

    if (!endElement) return;

    const endPageWrapper =
      endElement.closest(
        "[data-paper-page]"
      );

    if (
      endPageWrapper !== pageWrapper
    ) {
      alert(
        "형광펜은 한 페이지 안에서만 선택해줘."
      );

      clearSelection();

      return;
    }

    const pageRect =
      pageWrapper.getBoundingClientRect();

    const clientRects =
      Array.from(
        range.getClientRects()
      );

    const rects: HighlightRect[] =
      clientRects
        .filter(
          (rect) =>
            rect.width > 0 &&
            rect.height > 0
        )
        .map((rect) => ({
          left:
            rect.left -
            pageRect.left,

          top:
            rect.top -
            pageRect.top,

          width:
            rect.width,

          height:
            rect.height,
        }));

    if (rects.length === 0) return;

    setSelectedText(text);

    setPendingSelection({
      text,
      page,
      rects,
    });

    const lastRect =
      clientRects[
        clientRects.length - 1
      ];

    setMenuPosition({
      x:
        lastRect.left +
        window.scrollX,

      y:
        lastRect.bottom +
        window.scrollY +
        8,
    });
  };

  // ==============================
  // 단어 / 개념 추가
  // ==============================

  const startNote = (
    type: "word" | "concept"
  ) => {
    if (!pendingSelection) return;

    const id = Date.now();

    const newHighlight: Highlight = {
      id,

      page:
        pendingSelection.page,

      type,

      text:
        pendingSelection.text,

      rects:
        pendingSelection.rects,
    };

    setHighlights((prev) => [
      ...prev,
      newHighlight,
    ]);

    setSelectedText(
      pendingSelection.text
    );

    setCurrentType(type);

    setPendingHighlightId(id);

    window
      .getSelection()
      ?.removeAllRanges();

    setShowMemoBox(true);
  };

  // ==============================
  // 피규어 드래그 시작
  // ==============================

  const startFigureDrag = (
    event: React.MouseEvent<HTMLDivElement>,
    page: number
  ) => {
    if (!figureMode) return;

    if (showMemoBox) return;

    event.preventDefault();
    event.stopPropagation();

    const rect =
      event.currentTarget.getBoundingClientRect();

    const x =
      event.clientX -
      rect.left;

    const y =
      event.clientY -
      rect.top;

    setFigureDrag({
      page,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    });
  };

  // ==============================
  // 피규어 드래그 이동
  // ==============================

  const moveFigureDrag = (
    event: React.MouseEvent<HTMLDivElement>,
    page: number
  ) => {
    if (!figureMode) return;

    if (!figureDrag) return;

    if (
      figureDrag.page !== page
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect =
      event.currentTarget.getBoundingClientRect();

    const x =
      event.clientX -
      rect.left;

    const y =
      event.clientY -
      rect.top;

    setFigureDrag((prev) => {
      if (!prev) return null;

      return {
        ...prev,
        currentX: x,
        currentY: y,
      };
    });
  };

  // ==============================
  // 피규어 드래그 종료
  // ==============================

  const finishFigureDrag = (
    event: React.MouseEvent<HTMLDivElement>,
    page: number
  ) => {
    if (!figureMode) return;

    if (!figureDrag) return;

    if (
      figureDrag.page !== page
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const left =
      Math.min(
        figureDrag.startX,
        figureDrag.currentX
      );

    const top =
      Math.min(
        figureDrag.startY,
        figureDrag.currentY
      );

    const width =
      Math.abs(
        figureDrag.currentX -
        figureDrag.startX
      );

    const height =
      Math.abs(
        figureDrag.currentY -
        figureDrag.startY
      );

    setFigureDrag(null);

    // 너무 작은 드래그는 무시
    if (
      width < 10 ||
      height < 10
    ) {
      return;
    }

    const id = Date.now();

    const figureText =
      `Figure - Page ${page}`;

    const newHighlight: Highlight = {
      id,
      page,
      type: "figure",
      text: figureText,

      rects: [
        {
          left,
          top,
          width,
          height,
        },
      ],
    };

    setHighlights((prev) => [
      ...prev,
      newHighlight,
    ]);

    setSelectedText(
      figureText
    );

    setCurrentType(
      "figure"
    );

    setPendingHighlightId(
      id
    );

    setMenuPosition({
      x:
        event.clientX +
        window.scrollX +
        10,

      y:
        event.clientY +
        window.scrollY +
        10,
    });

    setShowMemoBox(true);

    // 한 번 선택 후 자동으로
    // 피규어 모드 종료
    setFigureMode(false);
  };

  // ==============================
  // 현재 드래그 중인 피규어 사각형
  // ==============================

  const getFigureDragRect = (
    page: number
  ): HighlightRect | null => {
    if (!figureDrag) return null;

    if (
      figureDrag.page !== page
    ) {
      return null;
    }

    return {
      left:
        Math.min(
          figureDrag.startX,
          figureDrag.currentX
        ),

      top:
        Math.min(
          figureDrag.startY,
          figureDrag.currentY
        ),

      width:
        Math.abs(
          figureDrag.currentX -
          figureDrag.startX
        ),

      height:
        Math.abs(
          figureDrag.currentY -
          figureDrag.startY
        ),
    };
  };

  // ==============================
  // 메모 저장
  // ==============================

  const saveMemo = () => {
    if (
      !memoText.trim() ||
      pendingHighlightId === null
    ) {
      return;
    }

    const targetHighlight =
      highlights.find(
        (highlight) =>
          highlight.id ===
          pendingHighlightId
      );

    if (!targetHighlight) {
      return;
    }

    const newNote: Note = {
      id: Date.now(),

      highlightId:
        pendingHighlightId,

      text:
        selectedText,

      memo:
        memoText.trim(),

      type:
        currentType,

      page:
        targetHighlight.page,
    };

    setNotes((prev) => [
      ...prev,
      newNote,
    ]);

    setMemoText("");

    setShowMemoBox(false);

    setPendingHighlightId(null);

    clearSelection();
  };

  // ==============================
  // 메모 작성 취소
  // ==============================

  const cancelMemo = () => {
    // 방금 만든 표시도 삭제
    if (
      pendingHighlightId !== null
    ) {
      setHighlights((prev) =>
        prev.filter(
          (highlight) =>
            highlight.id !==
            pendingHighlightId
        )
      );
    }

    setPendingHighlightId(null);

    setMemoText("");

    setShowMemoBox(false);

    clearSelection();
  };

  // ==============================
  // 메모 삭제
  // 표시도 같이 삭제
  // ==============================

  const deleteNote = (
    note: Note
  ) => {
    setNotes((prev) =>
      prev.filter(
        (item) =>
          item.id !== note.id
      )
    );

    setHighlights((prev) =>
      prev.filter(
        (highlight) =>
          highlight.id !==
          note.highlightId
      )
    );
  };

  // ==============================
  // 텍스트 형광펜 지우개
  // ==============================

  const eraseHighlight = () => {
    if (!pendingSelection) return;

    const selection =
      pendingSelection;

    const targets =
      highlights.filter(
        (highlight) => {
          // 피규어는 텍스트 지우개로
          // 지우지 않음
          if (
            highlight.type ===
            "figure"
          ) {
            return false;
          }

          if (
            highlight.page !==
            selection.page
          ) {
            return false;
          }

          return highlight.rects.some(
            (highlightRect) =>
              selection.rects.some(
                (selectRect) => {
                  const noOverlap =
                    highlightRect.left +
                      highlightRect.width <
                      selectRect.left ||

                    selectRect.left +
                      selectRect.width <
                      highlightRect.left ||

                    highlightRect.top +
                      highlightRect.height <
                      selectRect.top ||

                    selectRect.top +
                      selectRect.height <
                      highlightRect.top;

                  return !noOverlap;
                }
              )
          );
        }
      );

    if (
      targets.length === 0
    ) {
      clearSelection();
      return;
    }

    const ids =
      targets.map(
        (target) =>
          target.id
      );

    setHighlights((prev) =>
      prev.filter(
        (highlight) =>
          !ids.includes(
            highlight.id
          )
      )
    );

    setNotes((prev) =>
      prev.filter(
        (note) =>
          !ids.includes(
            note.highlightId
          )
      )
    );

    clearSelection();
  };

  // ==============================
  // Notes 필터
  // ==============================

  const filteredNotes =
    notes.filter(
      (note) =>
        note.type ===
        viewType
    );

  return (
    <div>
      {/* ======================
          위쪽 도구
      ====================== */}

      <div
        className="
          flex
          items-center
          gap-3
          mb-5
        "
      >
        <button
          className={`
            px-4
            py-2
            rounded-lg
            border
            font-medium

            ${
              figureMode
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white hover:bg-gray-50"
            }
          `}
          onClick={() => {
            setFigureMode(
              !figureMode
            );

            clearSelection();
          }}
        >
          {figureMode
            ? "피규어 선택 중..."
            : "피규어 선택"}
        </button>

        {figureMode && (
          <span
            className="
              text-sm
              text-blue-600
            "
          >
            PDF에서 원하는 그림 영역을
            마우스로 드래그해.
          </span>
        )}
      </div>

      <div
        className="flex gap-6"
        onMouseUp={
          handleMouseUp
        }
      >
        {/* ======================
            PDF 영역
        ====================== */}

        <div className="flex-1">

          <div
            className="
              bg-white
              p-4
              rounded-xl
              shadow
            "
          >

            <Document
              file={file}
              onLoadSuccess={({
                numPages,
              }) => {
                setNumPages(
                  numPages
                );
              }}
            >

              {Array.from(
                {
                  length:
                    numPages,
                },

                (_, index) => {
                  const page =
                    index + 1;

                  const pageHighlights =
                    highlights.filter(
                      (highlight) =>
                        highlight.page ===
                        page
                    );

                  const dragRect =
                    getFigureDragRect(
                      page
                    );

                  return (
                    <div
                      key={page}
                      data-paper-page={
                        page
                      }
                      className="
                        relative
                        inline-block
                        mb-6
                      "
                    >

                      <Page
                        pageNumber={
                          page
                        }
                        width={900}
                        renderAnnotationLayer={
                          false
                        }
                      />

                      {/* ======================
                          저장된 표시 Overlay
                      ====================== */}

                      <div
                        className="
                          absolute
                          inset-0
                          pointer-events-none
                          z-10
                        "
                      >
                        {pageHighlights.map(
                          (
                            highlight
                          ) =>
                            highlight.rects.map(
                              (
                                rect,
                                rectIndex
                              ) => {
                                // 피규어
                                if (
                                  highlight.type ===
                                  "figure"
                                ) {
                                  return (
                                    <div
                                      key={`${highlight.id}-${rectIndex}`}
                                      className="
                                        absolute
                                        border-2
                                        border-blue-500
                                        rounded
                                      "
                                      style={{
                                        left:
                                          rect.left,

                                        top:
                                          rect.top +1 ,

                                        width:
                                          rect.width,

                                        height:
                                           Math.max(rect.height - 6, 1),

                                        backgroundColor:
                                          "rgba(59, 130, 246, 0.06)",
                                      }}
                                    />
                                  );
                                }

                                // 단어 / 개념
                                return (
                                  <div
                                    key={`${highlight.id}-${rectIndex}`}
                                    className="
                                      absolute
                                      rounded-sm
                                    "
                                    style={{
                                      left:
                                        rect.left,

                                      top:
                                        rect.top,

                                      width:
                                        rect.width,

                                      height:
                                        rect.height,

                                      backgroundColor:
                                        highlight.type ===
                                        "word"
                                          ? "rgba(255, 230, 0, 0.30)"
                                          : "rgba(255, 70, 70, 0.25)",
                                    }}
                                  />
                                );
                              }
                            )
                        )}

                        {/* 드래그 중인 피규어 */}

                        {dragRect && (
                          <div
                            className="
                              absolute
                              border-2
                              border-blue-600
                              bg-blue-200/20
                              rounded
                            "
                            style={{
                              left:
                                dragRect.left,

                              top:
                                dragRect.top,

                              width:
                                dragRect.width,

                              height:
                                dragRect.height,
                            }}
                          />
                        )}
                      </div>

                      {/* ======================
                          피규어 선택용 마우스 레이어
                      ====================== */}

                      {figureMode && (
                        <div
                          className="
                            absolute
                            inset-0
                            z-30
                            cursor-crosshair
                          "
                          onMouseDown={(
                            event
                          ) =>
                            startFigureDrag(
                              event,
                              page
                            )
                          }
                          onMouseMove={(
                            event
                          ) =>
                            moveFigureDrag(
                              event,
                              page
                            )
                          }
                          onMouseUp={(
                            event
                          ) =>
                            finishFigureDrag(
                              event,
                              page
                            )
                          }
                        />
                      )}
                    </div>
                  );
                }
              )}

            </Document>

          </div>

        </div>

        {/* ======================
            Study Notes
        ====================== */}

        <div className="w-80">

          <div
            className="
              bg-white
              rounded-xl
              shadow
              p-4
              sticky
              top-4
            "
          >
            <h2
              className="
                text-xl
                font-bold
                mb-4
              "
            >
              Study Notes
            </h2>

            {/* ======================
                단어 / 개념 / 피규어 탭
            ====================== */}

            <div
              className="
                flex
                gap-2
                mb-5
              "
            >

              <button
                className={`
                  flex-1
                  px-2
                  py-2
                  rounded
                  text-sm

                  ${
                    viewType ===
                    "word"
                      ? "bg-yellow-200 font-bold"
                      : "bg-gray-100"
                  }
                `}
                onClick={() =>
                  setViewType(
                    "word"
                  )
                }
              >
                단어
              </button>

              <button
                className={`
                  flex-1
                  px-2
                  py-2
                  rounded
                  text-sm

                  ${
                    viewType ===
                    "concept"
                      ? "bg-red-200 font-bold"
                      : "bg-gray-100"
                  }
                `}
                onClick={() =>
                  setViewType(
                    "concept"
                  )
                }
              >
                개념
              </button>

              <button
                className={`
                  flex-1
                  px-2
                  py-2
                  rounded
                  text-sm

                  ${
                    viewType ===
                    "figure"
                      ? "bg-blue-200 font-bold"
                      : "bg-gray-100"
                  }
                `}
                onClick={() =>
                  setViewType(
                    "figure"
                  )
                }
              >
                피규어
              </button>

            </div>

            {filteredNotes.length ===
              0 && (
              <p
                className="
                  text-gray-400
                  text-sm
                "
              >
                저장된 내용이 없음
              </p>
            )}

            {filteredNotes.map(
              (note) => (
                <div
                  key={note.id}
                  className="
                    border-b
                    pb-4
                    mb-4
                  "
                >

                  <div
                    className="
                      font-semibold
                      break-words
                    "
                  >
                    {note.type ===
                    "figure"
                      ? `Figure · Page ${note.page}`
                      : note.text}
                  </div>

                  <div
                    className="
                      text-sm
                      text-gray-600
                      mt-2
                      whitespace-pre-wrap
                    "
                  >
                    {note.memo}
                  </div>

                  <button
                    className="
                      text-xs
                      text-red-500
                      mt-2
                    "
                    onClick={() =>
                      deleteNote(
                        note
                      )
                    }
                  >
                    삭제
                  </button>

                </div>
              )
            )}

          </div>

        </div>

        {/* ======================
            텍스트 선택 메뉴
        ====================== */}

        {selectedText &&
          pendingSelection &&
          !showMemoBox &&
          !figureMode && (

            <div
              className="
                absolute
                bg-white
                border
                rounded-lg
                shadow-lg
                p-2
                flex
                gap-2
                z-50
              "
              style={{
                left:
                  menuPosition.x,

                top:
                  menuPosition.y,
              }}
              onMouseUp={(e) =>
                e.stopPropagation()
              }
            >

              <button
                className="
                  px-3
                  py-1
                  bg-yellow-200
                  rounded
                "
                onClick={() =>
                  startNote(
                    "word"
                  )
                }
              >
                단어
              </button>

              <button
                className="
                  px-3
                  py-1
                  bg-red-200
                  rounded
                "
                onClick={() =>
                  startNote(
                    "concept"
                  )
                }
              >
                개념
              </button>

              <button
                className="
                  px-3
                  py-1
                  bg-gray-200
                  rounded
                "
                onClick={
                  eraseHighlight
                }
              >
                지우개
              </button>

            </div>
          )}

        {/* ======================
            메모 입력창
        ====================== */}

        {showMemoBox && (

          <div
            className="
              absolute
              bg-white
              border
              rounded-xl
              shadow-xl
              p-4
              z-50
              w-96
            "
            style={{
              left:
                menuPosition.x,

              top:
                menuPosition.y,
            }}
            onMouseUp={(e) =>
              e.stopPropagation()
            }
          >

            <div
              className="
                font-semibold
                mb-1
                break-words
              "
            >
              {currentType ===
              "figure"
                ? selectedText
                : selectedText}
            </div>

            <div
              className="
                text-xs
                text-gray-500
                mb-3
              "
            >
              {currentType ===
              "word"
                ? "모르는 단어"
                : currentType ===
                  "concept"
                ? "모르는 개념"
                : "피규어 메모"}
            </div>

            <textarea
              autoFocus
              className="
                w-full
                border
                rounded-lg
                p-3
                h-32
              "
              placeholder={
                currentType ===
                "word"
                  ? "이 단어의 뜻을 적어..."
                  : currentType ===
                    "concept"
                  ? "이 개념에 대해 이해한 내용을 적어..."
                  : "이 피규어에서 중요한 내용을 적어..."
              }
              value={memoText}
              onChange={(e) =>
                setMemoText(
                  e.target.value
                )
              }
            />

            <div
              className="
                flex
                gap-2
                mt-3
              "
            >

              <button
                className="
                  px-4
                  py-2
                  bg-black
                  text-white
                  rounded
                "
                onClick={
                  saveMemo
                }
              >
                저장
              </button>

              <button
                className="
                  px-4
                  py-2
                  bg-gray-200
                  rounded
                "
                onClick={
                  cancelMemo
                }
              >
                취소
              </button>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}