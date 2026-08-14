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

type HighlightType =
  | "word"
  | "concept"
  | "figure"
  | "underline";

type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Highlight = {
  id: number;
  page: number;
  type: HighlightType;
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

const BLACK_CROSSHAIR_CURSOR =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cline x1='8' y1='0' x2='8' y2='16' stroke='black' stroke-width='1.5'/%3E%3Cline x1='0' y1='8' x2='16' y2='8' stroke='black' stroke-width='1.5'/%3E%3C/svg%3E") 8 8, crosshair`;

export default function PdfViewer({ file }: Props) {
  const [numPages, setNumPages] = useState(0);

  const [selectedText, setSelectedText] =
    useState("");

  const [pendingSelection, setPendingSelection] =
    useState<PendingSelection | null>(null);

  const [menuPosition, setMenuPosition] = useState({
    x: 0,
    y: 0,
  });

  const [showMemoBox, setShowMemoBox] =
    useState(false);

  const [memoText, setMemoText] =
    useState("");

  const [currentType, setCurrentType] =
    useState<NoteType>("word");

  const [viewType, setViewType] =
    useState<NoteType>("word");

  const [notes, setNotes] =
    useState<Note[]>([]);

  const [highlights, setHighlights] =
    useState<Highlight[]>([]);

  const [
    pendingHighlightId,
    setPendingHighlightId,
  ] = useState<number | null>(null);

  const [loaded, setLoaded] =
    useState(false);

  // ==============================
  // 수정 중인 메모
  // ==============================

  const [
    editingNoteId,
    setEditingNoteId,
  ] = useState<number | null>(null);

  // ==============================
  // 피규어 선택
  // ==============================

  const [figureMode, setFigureMode] =
    useState(false);

  const [figureDrag, setFigureDrag] =
    useState<FigureDrag | null>(null);

  // ==============================
  // PDF hover
  // ==============================

  const [
    hoveredHighlightId,
    setHoveredHighlightId,
  ] = useState<number | null>(null);

  // ==============================
  // Study Note hover
  // ==============================

  const [
    hoveredNoteId,
    setHoveredNoteId,
  ] = useState<number | null>(null);

  // ==============================
  // 피규어 이동 후 강조
  // ==============================

  const [
    focusedFigureId,
    setFocusedFigureId,
  ] = useState<number | null>(null);

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
  // 저장 데이터 불러오기
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
      const data =
        JSON.parse(saved);

      setNotes(
        data.notes ?? []
      );

      setHighlights(
        data.highlights ?? []
      );
    } catch {
      setNotes([]);
      setHighlights([]);
    }

    setLoaded(true);
  }, [storageKey]);

  // ==============================
  // 자동 저장
  // ==============================

  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        notes,
        highlights,
      })
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
  // Highlight → Note 찾기
  // ==============================

  const getNoteByHighlightId = (
    highlightId: number
  ) => {
    return notes.find(
      (note) =>
        note.highlightId ===
        highlightId
    );
  };

  // ==============================
  // 텍스트 선택
  // ==============================

  const handleMouseUp = () => {
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
      selection
        .toString()
        .trim();

    if (!text) return;

    const range =
      selection.getRangeAt(0);

    let startElement:
      | Element
      | null = null;

    if (
      range.startContainer.nodeType ===
      Node.TEXT_NODE
    ) {
      startElement =
        range.startContainer.parentElement;
    } else if (
      range.startContainer instanceof
      Element
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
      !(
        pageWrapper instanceof
        HTMLElement
      )
    ) {
      return;
    }

    const page =
      Number(
        pageWrapper.dataset.paperPage
      );

    if (!page) return;

    let endElement:
      | Element
      | null = null;

    if (
      range.endContainer.nodeType ===
      Node.TEXT_NODE
    ) {
      endElement =
        range.endContainer.parentElement;
    } else if (
      range.endContainer instanceof
      Element
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
      endPageWrapper !==
      pageWrapper
    ) {
      alert(
        "선택은 한 페이지 안에서만 해줘."
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

    const rects:
      HighlightRect[] =
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

    if (
      rects.length === 0
    ) {
      return;
    }

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
  // 단어 / 개념
  // ==============================

  const startNote = (
    type: "word" | "concept"
  ) => {
    if (!pendingSelection) {
      return;
    }

    const id =
      Date.now();

    const newHighlight:
      Highlight = {
      id,

      page:
        pendingSelection.page,

      type,

      text:
        pendingSelection.text,

      rects:
        pendingSelection.rects,
    };

    setHighlights(
      (prev) => [
        ...prev,
        newHighlight,
      ]
    );

    setSelectedText(
      pendingSelection.text
    );

    setCurrentType(type);

    setPendingHighlightId(
      id
    );

    setEditingNoteId(
      null
    );

    window
      .getSelection()
      ?.removeAllRanges();

    setShowMemoBox(true);
  };

  // ==============================
  // 밑줄
  // ==============================

  const addUnderline = () => {
    if (!pendingSelection) {
      return;
    }

    const id =
      Date.now();

    const newHighlight:
      Highlight = {
      id,

      page:
        pendingSelection.page,

      type:
        "underline",

      text:
        pendingSelection.text,

      rects:
        pendingSelection.rects,
    };

    setHighlights(
      (prev) => [
        ...prev,
        newHighlight,
      ]
    );

    clearSelection();
  };

  // ==============================
  // 피규어 시작
  // ==============================

  const startFigureDrag = (
    event:
      React.MouseEvent<HTMLDivElement>,
    page: number
  ) => {
    if (!figureMode) return;

    if (showMemoBox) return;

    event.preventDefault();
    event.stopPropagation();

    const rect =
      event.currentTarget
        .getBoundingClientRect();

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
  // 피규어 이동
  // ==============================

  const moveFigureDrag = (
    event:
      React.MouseEvent<HTMLDivElement>,
    page: number
  ) => {
    if (!figureMode) return;

    if (!figureDrag) return;

    if (
      figureDrag.page !==
      page
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect =
      event.currentTarget
        .getBoundingClientRect();

    const x =
      event.clientX -
      rect.left;

    const y =
      event.clientY -
      rect.top;

    setFigureDrag(
      (prev) => {
        if (!prev) {
          return null;
        }

        return {
          ...prev,
          currentX: x,
          currentY: y,
        };
      }
    );
  };

  // ==============================
  // 피규어 종료
  // ==============================

  const finishFigureDrag = (
    event:
      React.MouseEvent<HTMLDivElement>,
    page: number
  ) => {
    if (!figureMode) return;

    if (!figureDrag) return;

    if (
      figureDrag.page !==
      page
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

    if (
      width < 10 ||
      height < 10
    ) {
      return;
    }

    const id =
      Date.now();

    const figureText =
      `Figure - Page ${page}`;

    const newHighlight:
      Highlight = {
      id,
      page,

      type:
        "figure",

      text:
        figureText,

      rects: [
        {
          left,
          top,
          width,
          height,
        },
      ],
    };

    setHighlights(
      (prev) => [
        ...prev,
        newHighlight,
      ]
    );

    setSelectedText(
      figureText
    );

    setCurrentType(
      "figure"
    );

    setPendingHighlightId(
      id
    );

    setEditingNoteId(
      null
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

    setFigureMode(false);
  };

  // ==============================
  // 드래그 사각형
  // ==============================

  const getFigureDragRect = (
    page: number
  ): HighlightRect | null => {
    if (!figureDrag) {
      return null;
    }

    if (
      figureDrag.page !==
      page
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
  // 메모 수정 열기
  // ==============================

  const openEditMemo = (
    event:
      React.MouseEvent,
    note: Note
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setHoveredHighlightId(
      null
    );

    setHoveredNoteId(
      null
    );

    setEditingNoteId(
      note.id
    );

    setPendingHighlightId(
      null
    );

    setSelectedText(
      note.text
    );

    setCurrentType(
      note.type
    );

    setMemoText(
      note.memo
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

    setShowMemoBox(
      true
    );
  };

  // ==============================
  // 메모 저장
  // ==============================

  const saveMemo = () => {
    if (!memoText.trim()) {
      return;
    }

    // ============================
    // 기존 메모 수정
    // ============================

    if (
      editingNoteId !==
      null
    ) {
      setNotes(
        (prev) =>
          prev.map(
            (note) =>
              note.id ===
              editingNoteId
                ? {
                    ...note,
                    memo:
                      memoText.trim(),
                  }
                : note
          )
      );

      setEditingNoteId(
        null
      );

      setMemoText("");

      setShowMemoBox(
        false
      );

      clearSelection();

      return;
    }

    // ============================
    // 새 메모
    // ============================

    if (
      pendingHighlightId ===
      null
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

    const newNote:
      Note = {
      id:
        Date.now(),

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

    setNotes(
      (prev) => [
        ...prev,
        newNote,
      ]
    );

    setMemoText("");

    setShowMemoBox(
      false
    );

    setPendingHighlightId(
      null
    );

    clearSelection();
  };

  // ==============================
  // 취소
  // ==============================

  const cancelMemo = () => {
    // 수정 중이면
    // 기존 highlight 삭제 안 함

    if (
      editingNoteId !==
      null
    ) {
      setEditingNoteId(
        null
      );

      setMemoText("");

      setShowMemoBox(
        false
      );

      clearSelection();

      return;
    }

    // 새 메모 작성 취소

    if (
      pendingHighlightId !==
      null
    ) {
      setHighlights(
        (prev) =>
          prev.filter(
            (highlight) =>
              highlight.id !==
              pendingHighlightId
          )
      );
    }

    setPendingHighlightId(
      null
    );

    setMemoText("");

    setShowMemoBox(
      false
    );

    clearSelection();
  };

  // ==============================
  // 메모 삭제
  // ==============================

  const deleteNote = (
    note: Note
  ) => {
    setNotes(
      (prev) =>
        prev.filter(
          (item) =>
            item.id !==
            note.id
        )
    );

    setHighlights(
      (prev) =>
        prev.filter(
          (highlight) =>
            highlight.id !==
            note.highlightId
        )
    );

    setHoveredNoteId(
      null
    );

    setHoveredHighlightId(
      null
    );
  };

  // ==============================
  // 지우개
  // ==============================

  const eraseHighlight = () => {
    if (!pendingSelection) {
      return;
    }

    const selection =
      pendingSelection;

    const targets =
      highlights.filter(
        (highlight) => {
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
            (
              highlightRect
            ) =>
              selection.rects.some(
                (
                  selectRect
                ) => {
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

    setHighlights(
      (prev) =>
        prev.filter(
          (highlight) =>
            !ids.includes(
              highlight.id
            )
        )
    );

    setNotes(
      (prev) =>
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
  // 피규어로 이동
  // ==============================

  const goToFigure = (
    note: Note
  ) => {
    if (
      note.type !==
      "figure"
    ) {
      return;
    }

    const element =
      document.getElementById(
        `figure-highlight-${note.highlightId}`
      );

    if (!element) return;

    element.scrollIntoView({
      behavior:
        "smooth",

      block:
        "center",
    });

    setFocusedFigureId(
      note.highlightId
    );

    window.setTimeout(
      () => {
        setFocusedFigureId(
          null
        );
      },
      1600
    );
  };

  // ==============================
  // 필터
  // ==============================

  const filteredNotes =
    notes.filter(
      (note) =>
        note.type ===
        viewType
    );

  return (
    <div
      className="
        flex
        gap-6
      "
      onMouseUp={
        handleMouseUp
      }
    >
      {/* ==========================
          PDF
      ========================== */}

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

                      width={
                        900
                      }

                      renderAnnotationLayer={
                        false
                      }
                    />

                    {/* ==========================
                        Overlay
                    ========================== */}

                    <div
                      className="
                        absolute
                        inset-0
                        z-10
                        pointer-events-none
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
                              const note =
                                getNoteByHighlightId(
                                  highlight.id
                                );

                              const isHovered =
                                hoveredHighlightId ===
                                highlight.id;

                              // =====================
                              // 밑줄
                              // =====================

                              if (
                                highlight.type ===
                                "underline"
                              ) {
                                return (
                                  <div
                                    key={`${highlight.id}-${rectIndex}`}
                                    className="
                                      absolute
                                      pointer-events-none
                                    "
                                    style={{
                                      left:
                                        rect.left,

                                      top:
                                        rect.top + rect.height - 1,

                                      width:
                                        rect.width,

                                      height:
                                        1,

                                      backgroundColor:
                                        "#b91c1c",
                                    }}
                                  />
                                );
                              }

                              // =====================
                              // 피규어
                              // =====================

                              if (
                                highlight.type ===
                                "figure"
                              ) {
                                const isFocused =
                                  focusedFigureId ===
                                  highlight.id;

                                return (
                                  <div
                                    id={`figure-highlight-${highlight.id}`}

                                    key={`${highlight.id}-${rectIndex}`}

                                    className="
                                      absolute
                                      rounded
                                      pointer-events-auto
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

                                      border:
                                        isFocused
                                          ? "4px solid rgb(37, 99, 235)"
                                          : "2px solid rgb(59, 130, 246)",

                                      backgroundColor:
                                        isFocused
                                          ? "rgba(59, 130, 246, 0.16)"
                                          : "rgba(59, 130, 246, 0.06)",

                                      transition:
                                        "all 0.2s ease",
                                    }}

                                    onMouseEnter={() =>
                                      setHoveredHighlightId(
                                        highlight.id
                                      )
                                    }

                                    onMouseLeave={() =>
                                      setHoveredHighlightId(
                                        null
                                      )
                                    }
                                  >

                                    {isHovered &&
                                      note && (

                                        <div
                                          className="
                                            absolute
                                            left-0
                                            bottom-full
                                            mb-2
                                            w-72
                                            bg-black
                                            text-white
                                            text-sm
                                            p-3
                                            rounded-lg
                                            shadow-xl
                                            z-50
                                          "
                                        >

                                          <div
                                            className="
                                              flex
                                              items-center
                                              justify-between
                                              gap-3
                                              mb-2
                                            "
                                          >

                                            <div
                                              className="
                                                font-semibold
                                              "
                                            >
                                              Figure · Page{" "}
                                              {
                                                note.page
                                              }
                                            </div>

                                            <button
                                              className="
                                                text-xs
                                                shrink-0
                                                text-blue-300
                                                hover:text-white
                                              "

                                              onClick={(
                                                event
                                              ) =>
                                                openEditMemo(
                                                  event,
                                                  note
                                                )
                                              }
                                            >
                                              수정
                                            </button>

                                          </div>

                                          <div
                                            className="
                                              whitespace-pre-wrap
                                            "
                                          >
                                            {
                                              note.memo
                                            }
                                          </div>

                                        </div>

                                      )}

                                  </div>
                                );
                              }

                              // =====================
                              // 단어 / 개념
                              // =====================

                              return (
                                <div
                                  key={`${highlight.id}-${rectIndex}`}

                                  className="
                                    absolute
                                    rounded-sm
                                    pointer-events-auto
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

                                    cursor:
                                      note
                                        ? "help"
                                        : "default",
                                  }}

                                  onMouseEnter={() =>
                                    setHoveredHighlightId(
                                      highlight.id
                                    )
                                  }

                                  onMouseLeave={() =>
                                    setHoveredHighlightId(
                                      null
                                    )
                                  }
                                >

                                  {isHovered &&
                                    note &&
                                    rectIndex ===
                                      0 && (

                                      <div
                                        className="
                                          absolute
                                          left-0
                                          bottom-full
                                          mb-2
                                          w-72
                                          bg-black
                                          text-white
                                          text-sm
                                          p-3
                                          rounded-lg
                                          shadow-xl
                                          z-50
                                        "
                                      >

                                        {/* 제목 + 수정 */}

                                        <div
                                          className="
                                            flex
                                            items-start
                                            justify-between
                                            gap-3
                                            mb-2
                                          "
                                        >

                                          <div
                                            className="
                                              font-semibold
                                              break-words
                                              min-w-0
                                            "
                                          >
                                            {
                                              note.text
                                            }
                                          </div>

                                          <button
                                            className="
                                              text-xs
                                              text-blue-300
                                              hover:text-white
                                              shrink-0
                                            "

                                            onClick={(
                                              event
                                            ) =>
                                              openEditMemo(
                                                event,
                                                note
                                              )
                                            }
                                          >
                                            수정
                                          </button>

                                        </div>

                                        <div
                                          className="
                                            whitespace-pre-wrap
                                          "
                                        >
                                          {
                                            note.memo
                                          }
                                        </div>

                                      </div>

                                    )}

                                </div>
                              );
                            }
                          )
                      )}

                      {/* 드래그 중 피규어 */}

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

                    {/* 피규어 선택 */}

                    {figureMode && (
                      <div
                        className="
                          absolute
                          inset-0
                          z-30
                        "

                        style={{
                          cursor:
                            BLACK_CROSSHAIR_CURSOR,
                        }}

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

      {/* ==========================
          Study Notes
      ========================== */}

      <div
        className="
          w-80
          shrink-0
        "
      >

        <div
          className="
            bg-white
            rounded-xl
            shadow
            sticky
            top-4
            h-[calc(100vh-2rem)]
            flex
            flex-col
            overflow-hidden
          "
        >

          {/* 상단 고정 */}

          <div
            className="
              p-4
              pb-3
              shrink-0
              border-b
              bg-white
              z-10
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

            {/* 피규어 */}

            <button
              className={`
                w-full
                px-4
                py-2
                mb-3
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
                : "+ 피규어 선택"}
            </button>

            {figureMode && (
              <div
                className="
                  text-xs
                  text-blue-600
                  mb-3
                "
              >
                PDF에서 원하는 영역을 드래그해.
              </div>
            )}

            {/* 탭 */}

            <div
              className="
                flex
                gap-2
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

          </div>

          {/* 목록 스크롤 */}

          <div
            className="
              flex-1
              min-h-0
              overflow-y-auto
              px-4
              py-2
            "
          >

            {filteredNotes.length ===
              0 && (

              <p
                className="
                  text-gray-400
                  text-sm
                  py-3
                "
              >
                저장된 내용이 없음
              </p>

            )}

            {filteredNotes.map(
              (note) => {
                const isFigure =
                  note.type ===
                  "figure";

                const isHovered =
                  hoveredNoteId ===
                  note.id;

                return (
                  <div
                    key={
                      note.id
                    }

                    className="
                      relative
                      border-b
                    "

                    onMouseEnter={() =>
                      setHoveredNoteId(
                        note.id
                      )
                    }

                    onMouseLeave={() =>
                      setHoveredNoteId(
                        null
                      )
                    }
                  >

                    <div
                      className={`
                        flex
                        items-center
                        gap-2
                        min-h-10
                        py-2

                        ${
                          isFigure
                            ? "cursor-pointer hover:bg-blue-50"
                            : "hover:bg-gray-50"
                        }
                      `}

                      onClick={() => {
                        if (
                          isFigure
                        ) {
                          goToFigure(
                            note
                          );
                        }
                      }}
                    >

                      {/* 이름 */}

                      <div
                        className="
                          flex-1
                          min-w-0
                          font-medium
                          text-sm
                          truncate
                        "

                        title={
                          isFigure
                            ? `Figure · Page ${note.page}`
                            : note.text
                        }
                      >
                        {isFigure
                          ? `Figure · Page ${note.page}`
                          : note.text}
                      </div>

                      {/* 수정 */}

                      <button
                        className="
                          shrink-0
                          text-xs
                          text-blue-500
                          hover:text-blue-700
                          px-1
                        "

                        onClick={(
                          event
                        ) =>
                          openEditMemo(
                            event,
                            note
                          )
                        }
                      >
                        수정
                      </button>

                      {/* 삭제 */}

                      <button
                        className="
                          shrink-0
                          text-xs
                          text-gray-400
                          hover:text-red-500
                          px-1
                        "

                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          deleteNote(
                            note
                          );
                        }}
                      >
                        삭제
                      </button>

                    </div>

                    {/* Hover 메모 */}

                    {isHovered && (
                      <div
                        className="
                          absolute
                          right-0
                          top-full
                          mt-1
                          w-72
                          bg-black
                          text-white
                          text-sm
                          p-3
                          rounded-lg
                          shadow-xl
                          z-50
                          whitespace-pre-wrap
                          pointer-events-none
                        "
                      >

                        <div
                          className="
                            font-semibold
                            mb-1
                            break-words
                          "
                        >
                          {isFigure
                            ? `Figure · Page ${note.page}`
                            : note.text}
                        </div>

                        <div>
                          {
                            note.memo
                          }
                        </div>

                      </div>
                    )}

                  </div>
                );
              }
            )}

          </div>

        </div>

      </div>

      {/* ==========================
          텍스트 선택 메뉴
      ========================== */}

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
              pt-7
              pb-2
              px-2
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
              type="button"
              aria-label="선택 메뉴 닫기"
              className="
                absolute
                top-1
                right-2
                text-lg
                leading-none
                text-gray-400
                hover:text-black
              "
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearSelection();
              }}
            >
              ×
            </button>

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

            {/* 밑줄 */}

            <button
              className="
                px-3
                py-1
                bg-white
                border
                border-gray-300
                rounded
                underline
                underline-offset-2
              "

              onClick={
                addUnderline
              }
            >
              밑줄
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

      {/* ==========================
          메모 입력 / 수정
      ========================== */}

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
            {
              selectedText
            }
          </div>

          <div
            className="
              text-xs
              text-gray-500
              mb-3
            "
          >
            {editingNoteId !==
            null
              ? "메모 수정"
              : currentType ===
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

            value={
              memoText
            }

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
              {editingNoteId !==
              null
                ? "수정 저장"
                : "저장"}
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
  );
}
