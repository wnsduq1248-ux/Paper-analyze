"use client";

import {
  useEffect,
  useState,
} from "react";

import dynamic from "next/dynamic";

import "react-pdf/dist/Page/TextLayer.css";

const PdfViewer = dynamic(
  () => import("./PdfViewer"),
  {
    ssr: false,
  }
);

// ==========================================
// 타입
// ==========================================

type StoredPdf = {
  id: string;

  name: string;

  size: number;

  lastModified: number;

  file: File;

  folderId: string | null;

  addedAt: number;
};

type Folder = {
  id: string;

  name: string;

  createdAt: number;
};

// ==========================================
// IndexedDB 설정
// ==========================================

const DB_NAME =
  "paper-note-db";

// 기존 버전 1 → 폴더 기능 때문에 2
const DB_VERSION = 2;

const PDF_STORE =
  "pdfs";

const FOLDER_STORE =
  "folders";

// ==========================================
// DB 열기
// ==========================================

function openDatabase(): Promise<IDBDatabase> {
  return new Promise(
    (resolve, reject) => {
      const request =
        indexedDB.open(
          DB_NAME,
          DB_VERSION
        );

      request.onerror =
        () => {
          reject(
            request.error
          );
        };

      request.onsuccess =
        () => {
          resolve(
            request.result
          );
        };

      request.onupgradeneeded =
        () => {
          const db =
            request.result;

          // PDF 저장소
          if (
            !db.objectStoreNames.contains(
              PDF_STORE
            )
          ) {
            db.createObjectStore(
              PDF_STORE,
              {
                keyPath: "id",
              }
            );
          }

          // 폴더 저장소
          if (
            !db.objectStoreNames.contains(
              FOLDER_STORE
            )
          ) {
            db.createObjectStore(
              FOLDER_STORE,
              {
                keyPath: "id",
              }
            );
          }
        };
    }
  );
}

// ==========================================
// PDF 목록 읽기
// ==========================================

async function getStoredPdfs(): Promise<
  StoredPdf[]
> {
  const db =
    await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          PDF_STORE,
          "readonly"
        );

      const store =
        transaction.objectStore(
          PDF_STORE
        );

      const request =
        store.getAll();

      request.onsuccess =
        () => {
          const result =
            request.result as StoredPdf[];

          // 이전 버전 PDF에는
          // folderId / addedAt이 없을 수 있음
          const normalized =
            result.map(
              (pdf) => ({
                ...pdf,

                folderId:
                  pdf.folderId ??
                  null,

                addedAt:
                  pdf.addedAt ??
                  pdf.lastModified ??
                  Date.now(),
              })
            );

          resolve(
            normalized
          );
        };

      request.onerror =
        () => {
          reject(
            request.error
          );
        };
    }
  );
}

// ==========================================
// PDF 저장
// ==========================================

async function savePdf(
  pdf: StoredPdf
) {
  const db =
    await openDatabase();

  return new Promise<void>(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          PDF_STORE,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          PDF_STORE
        );

      const request =
        store.put(pdf);

      request.onsuccess =
        () => {
          resolve();
        };

      request.onerror =
        () => {
          reject(
            request.error
          );
        };
    }
  );
}

// ==========================================
// PDF 삭제
// ==========================================

async function deletePdf(
  id: string
) {
  const db =
    await openDatabase();

  return new Promise<void>(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          PDF_STORE,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          PDF_STORE
        );

      const request =
        store.delete(id);

      request.onsuccess =
        () => {
          resolve();
        };

      request.onerror =
        () => {
          reject(
            request.error
          );
        };
    }
  );
}

// ==========================================
// 폴더 목록
// ==========================================

async function getFolders(): Promise<
  Folder[]
> {
  const db =
    await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          FOLDER_STORE,
          "readonly"
        );

      const store =
        transaction.objectStore(
          FOLDER_STORE
        );

      const request =
        store.getAll();

      request.onsuccess =
        () => {
          resolve(
            request.result as Folder[]
          );
        };

      request.onerror =
        () => {
          reject(
            request.error
          );
        };
    }
  );
}

// ==========================================
// 폴더 저장
// ==========================================

async function saveFolder(
  folder: Folder
) {
  const db =
    await openDatabase();

  return new Promise<void>(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          FOLDER_STORE,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          FOLDER_STORE
        );

      const request =
        store.put(folder);

      request.onsuccess =
        () => {
          resolve();
        };

      request.onerror =
        () => {
          reject(
            request.error
          );
        };
    }
  );
}

// ==========================================
// 폴더 삭제
// ==========================================

async function deleteFolder(
  id: string
) {
  const db =
    await openDatabase();

  return new Promise<void>(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          FOLDER_STORE,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          FOLDER_STORE
        );

      const request =
        store.delete(id);

      request.onsuccess =
        () => {
          resolve();
        };

      request.onerror =
        () => {
          reject(
            request.error
          );
        };
    }
  );
}

// ==========================================
// 메인
// ==========================================

export default function Home() {
  const [pdfs, setPdfs] =
    useState<StoredPdf[]>([]);

  const [folders, setFolders] =
    useState<Folder[]>([]);

  const [
    selectedPdf,
    setSelectedPdf,
  ] =
    useState<StoredPdf | null>(
      null
    );

  // null = 전체 논문
  // "unfiled" = 미분류
  // 그 외 = folder ID
  const [
    selectedFolder,
    setSelectedFolder,
  ] = useState<
    string | null
  >(null);

  const [
    showFolderInput,
    setShowFolderInput,
  ] =
    useState(false);

  const [
    newFolderName,
    setNewFolderName,
  ] =
    useState("");

  // ========================================
  // 첫 실행
  // ========================================

  useEffect(() => {
    loadEverything();
  }, []);

  const loadEverything =
    async () => {
      try {
        const [
          savedPdfs,
          savedFolders,
        ] =
          await Promise.all([
            getStoredPdfs(),
            getFolders(),
          ]);

        savedPdfs.sort(
          (a, b) =>
            b.addedAt -
            a.addedAt
        );

        savedFolders.sort(
          (a, b) =>
            a.createdAt -
            b.createdAt
        );

        setPdfs(
          savedPdfs
        );

        setFolders(
          savedFolders
        );
      } catch (error) {
        console.error(
          "저장 데이터 불러오기 실패:",
          error
        );
      }
    };

  // ========================================
  // 새 폴더 생성
  // ========================================

  const handleCreateFolder =
    async () => {
      const name =
        newFolderName.trim();

      if (!name) {
        return;
      }

      const duplicate =
        folders.some(
          (folder) =>
            folder.name.toLowerCase() ===
            name.toLowerCase()
        );

      if (duplicate) {
        alert(
          "같은 이름의 폴더가 이미 있어."
        );

        return;
      }

      const folder: Folder = {
        id:
          "folder-" +
          Date.now(),

        name,

        createdAt:
          Date.now(),
      };

      await saveFolder(
        folder
      );

      setNewFolderName("");

      setShowFolderInput(
        false
      );

      await loadEverything();

      // 만든 폴더로 바로 들어감
      setSelectedFolder(
        folder.id
      );
    };

  // ========================================
  // 폴더 삭제
  // ========================================

  const handleDeleteFolder =
    async (
      folder: Folder
    ) => {
      const ok =
        confirm(
          `"${folder.name}" 폴더를 삭제할까?\n\n안에 있는 PDF는 삭제되지 않고 미분류로 이동해.`
        );

      if (!ok) return;

      // 해당 폴더 PDF를
      // 미분류로 이동
      const insidePdfs =
        pdfs.filter(
          (pdf) =>
            pdf.folderId ===
            folder.id
        );

      for (
        const pdf of
        insidePdfs
      ) {
        await savePdf({
          ...pdf,

          folderId:
            null,
        });
      }

      await deleteFolder(
        folder.id
      );

      if (
        selectedFolder ===
        folder.id
      ) {
        setSelectedFolder(
          null
        );
      }

      await loadEverything();
    };

  // ========================================
  // PDF 추가
  // ========================================

  const handlePdfUpload =
    async (
      event:
        React.ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        event.target
          .files?.[0];

      if (!file) {
        return;
      }

      if (
        file.type !==
        "application/pdf"
      ) {
        alert(
          "PDF 파일만 선택할 수 있어."
        );

        return;
      }

      const id =
        file.name +
        "-" +
        file.size +
        "-" +
        file.lastModified;

      // 현재 폴더 안에서
      // PDF 추가하면 해당 폴더로
      let targetFolderId:
        | string
        | null = null;

      if (
        selectedFolder &&
        selectedFolder !==
          "unfiled"
      ) {
        targetFolderId =
          selectedFolder;
      }

      const pdf:
        StoredPdf = {
        id,

        name:
          file.name,

        size:
          file.size,

        lastModified:
          file.lastModified,

        file,

        folderId:
          targetFolderId,

        addedAt:
          Date.now(),
      };

      try {
        await savePdf(pdf);

        await loadEverything();

        setSelectedPdf(
          pdf
        );
      } catch (error) {
        console.error(
          "PDF 저장 실패:",
          error
        );
      }

      event.target.value =
        "";
    };

  // ========================================
  // PDF 삭제
  // ========================================

  const handleDeletePdf =
    async (
      pdf: StoredPdf
    ) => {
      const ok =
        confirm(
          `"${pdf.name}"을 목록에서 삭제할까?`
        );

      if (!ok) return;

      await deletePdf(
        pdf.id
      );

      if (
        selectedPdf?.id ===
        pdf.id
      ) {
        setSelectedPdf(
          null
        );
      }

      await loadEverything();
    };

  // ========================================
  // PDF 폴더 이동
  // ========================================

  const handleMovePdf =
    async (
      pdf: StoredPdf,
      folderId: string
    ) => {
      const destination =
        folderId ===
        "unfiled"
          ? null
          : folderId;

      await savePdf({
        ...pdf,

        folderId:
          destination,
      });

      await loadEverything();
    };

  // ========================================
  // 현재 선택 폴더의 PDF
  // ========================================

  const visiblePdfs =
    pdfs.filter(
      (pdf) => {
        // 전체 논문
        if (
          selectedFolder ===
          null
        ) {
          return true;
        }

        // 미분류
        if (
          selectedFolder ===
          "unfiled"
        ) {
          return (
            !pdf.folderId
          );
        }

        return (
          pdf.folderId ===
          selectedFolder
        );
      }
    );

  // ========================================
  // 현재 제목
  // ========================================

  const currentFolderName =
    selectedFolder ===
    null
      ? "전체 논문"
      : selectedFolder ===
          "unfiled"
      ? "미분류"
      : folders.find(
          (folder) =>
            folder.id ===
            selectedFolder
        )?.name ??
        "폴더";

  // ========================================
  // 폴더별 PDF 개수
  // ========================================

  const getFolderCount = (
    folderId: string
  ) => {
    return pdfs.filter(
      (pdf) =>
        pdf.folderId ===
        folderId
    ).length;
  };

  const unfiledCount =
    pdfs.filter(
      (pdf) =>
        !pdf.folderId
    ).length;

  // ========================================
  // PDF가 열려 있는 경우
  // ========================================

  if (selectedPdf) {
    return (
      <main
        className="
          min-h-screen
          bg-gray-100
          p-8
        "
      >
        <div
          className="
            flex
            items-center
            gap-4
            mb-5
          "
        >
          <button
            className="
              bg-white
              border
              px-4
              py-2
              rounded-lg
              hover:bg-gray-50
            "
            onClick={() =>
              setSelectedPdf(
                null
              )
            }
          >
            ← 논문 목록
          </button>

          <div
            className="
              font-semibold
              truncate
            "
          >
            {
              selectedPdf.name
            }
          </div>
        </div>

        <PdfViewer
          file={
            selectedPdf.file
          }
        />
      </main>
    );
  }

  // ========================================
  // 논문 목록 화면
  // ========================================

  return (
    <main
      className="
        min-h-screen
        bg-gray-100
        p-10
      "
    >
      {/* ===============================
          상단
      =============================== */}

      <div
        className="
          flex
          items-center
          justify-between
          mb-8
        "
      >
        <h1
          className="
            text-4xl
            font-bold
          "
        >
          Paper Note
        </h1>

        <div
          className="
            flex
            gap-3
          "
        >
          {/* 새 폴더 */}

          <button
            className="
              bg-white
              border
              px-5
              py-3
              rounded-lg
              hover:bg-gray-50
            "
            onClick={() =>
              setShowFolderInput(
                true
              )
            }
          >
            + 새 폴더
          </button>

          {/* PDF 추가 */}

          <label
            className="
              bg-black
              text-white
              px-5
              py-3
              rounded-lg
              cursor-pointer
              hover:bg-gray-800
            "
          >
            + PDF 추가

            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={
                handlePdfUpload
              }
            />
          </label>
        </div>
      </div>

      {/* ===============================
          새 폴더 입력
      =============================== */}

      {showFolderInput && (
        <div
          className="
            bg-white
            shadow
            rounded-xl
            p-4
            mb-6
            flex
            gap-3
            max-w-xl
          "
        >
          <input
            autoFocus
            type="text"
            placeholder="폴더 이름"
            className="
              flex-1
              border
              rounded-lg
              px-3
              py-2
            "
            value={
              newFolderName
            }
            onChange={(
              event
            ) =>
              setNewFolderName(
                event.target
                  .value
              )
            }
            onKeyDown={(
              event
            ) => {
              if (
                event.key ===
                "Enter"
              ) {
                handleCreateFolder();
              }
            }}
          />

          <button
            className="
              bg-black
              text-white
              px-4
              rounded-lg
            "
            onClick={
              handleCreateFolder
            }
          >
            만들기
          </button>

          <button
            className="
              bg-gray-100
              px-4
              rounded-lg
            "
            onClick={() => {
              setShowFolderInput(
                false
              );

              setNewFolderName(
                ""
              );
            }}
          >
            취소
          </button>
        </div>
      )}

      {/* ===============================
          메인 영역
      =============================== */}

      <div
        className="
          flex
          gap-6
          items-start
        "
      >
        {/* =============================
            왼쪽 폴더
        ============================= */}

        <aside
          className="
            w-64
            bg-white
            rounded-xl
            shadow
            p-3
            shrink-0
          "
        >
          <div
            className="
              text-sm
              text-gray-400
              font-semibold
              px-3
              py-2
            "
          >
            LIBRARY
          </div>

          {/* 전체 논문 */}

          <button
            className={`
              w-full
              flex
              items-center
              justify-between
              px-3
              py-3
              rounded-lg
              text-left

              ${
                selectedFolder ===
                null
                  ? "bg-gray-200 font-semibold"
                  : "hover:bg-gray-100"
              }
            `}
            onClick={() =>
              setSelectedFolder(
                null
              )
            }
          >
            <span>
              📚 전체 논문
            </span>

            <span
              className="
                text-xs
                text-gray-400
              "
            >
              {pdfs.length}
            </span>
          </button>

          {/* 미분류 */}

          <button
            className={`
              w-full
              flex
              items-center
              justify-between
              px-3
              py-3
              rounded-lg
              text-left

              ${
                selectedFolder ===
                "unfiled"
                  ? "bg-gray-200 font-semibold"
                  : "hover:bg-gray-100"
              }
            `}
            onClick={() =>
              setSelectedFolder(
                "unfiled"
              )
            }
          >
            <span>
              📄 미분류
            </span>

            <span
              className="
                text-xs
                text-gray-400
              "
            >
              {
                unfiledCount
              }
            </span>
          </button>

          {/* 구분선 */}

          <div
            className="
              border-t
              my-3
            "
          />

          {/* 폴더 */}

          {folders.map(
            (folder) => (
              <div
                key={
                  folder.id
                }
                className="
                  group
                  flex
                  items-center
                  rounded-lg
                "
              >
                <button
                  className={`
                    flex-1
                    flex
                    items-center
                    justify-between
                    px-3
                    py-3
                    rounded-lg
                    text-left

                    ${
                      selectedFolder ===
                      folder.id
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "hover:bg-gray-100"
                    }
                  `}
                  onClick={() =>
                    setSelectedFolder(
                      folder.id
                    )
                  }
                >
                  <span
                    className="
                      truncate
                    "
                  >
                    📁{" "}
                    {
                      folder.name
                    }
                  </span>

                  <span
                    className="
                      text-xs
                      text-gray-400
                      ml-2
                    "
                  >
                    {getFolderCount(
                      folder.id
                    )}
                  </span>
                </button>

                <button
                  title="폴더 삭제"
                  className="
                    hidden
                    group-hover:block
                    text-gray-400
                    hover:text-red-500
                    px-2
                  "
                  onClick={() =>
                    handleDeleteFolder(
                      folder
                    )
                  }
                >
                  ×
                </button>
              </div>
            )
          )}
        </aside>

        {/* =============================
            오른쪽 논문 목록
        ============================= */}

        <section
          className="
            flex-1
            min-w-0
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              mb-5
            "
          >
            <div>
              <h2
                className="
                  text-2xl
                  font-bold
                "
              >
                {
                  currentFolderName
                }
              </h2>

              <p
                className="
                  text-sm
                  text-gray-400
                  mt-1
                "
              >
                {
                  visiblePdfs.length
                }
                개의 논문
              </p>
            </div>
          </div>

          {visiblePdfs.length ===
          0 ? (
            <div
              className="
                bg-white
                rounded-xl
                shadow
                p-10
                text-center
                text-gray-400
              "
            >
              이 폴더에는
              아직 논문이 없어.
            </div>
          ) : (
            <div
              className="
                bg-white
                rounded-xl
                shadow
                overflow-hidden
              "
            >
              {visiblePdfs.map(
                (pdf) => (
                  <div
                    key={
                      pdf.id
                    }
                    className="
                      flex
                      items-center
                      gap-4
                      border-b
                      last:border-b-0
                      px-5
                      py-4
                      hover:bg-gray-50
                    "
                  >
                    {/* PDF 아이콘 */}

                    <div
                      className="
                        text-2xl
                      "
                    >
                      📄
                    </div>

                    {/* 논문 이름 */}

                    <button
                      className="
                        text-left
                        flex-1
                        font-medium
                        truncate
                      "
                      title={
                        pdf.name
                      }
                      onClick={() =>
                        setSelectedPdf(
                          pdf
                        )
                      }
                    >
                      {
                        pdf.name
                      }
                    </button>

                    {/* 폴더 이동 */}

                    <select
                      className="
                        border
                        rounded-lg
                        px-2
                        py-2
                        text-sm
                        bg-white
                        max-w-40
                      "
                      value={
                        pdf.folderId ??
                        "unfiled"
                      }
                      onChange={(
                        event
                      ) =>
                        handleMovePdf(
                          pdf,
                          event
                            .target
                            .value
                        )
                      }
                    >
                      <option
                        value="unfiled"
                      >
                        미분류
                      </option>

                      {folders.map(
                        (
                          folder
                        ) => (
                          <option
                            key={
                              folder.id
                            }
                            value={
                              folder.id
                            }
                          >
                            {
                              folder.name
                            }
                          </option>
                        )
                      )}
                    </select>

                    {/* 삭제 */}

                    <button
                      className="
                        text-sm
                        text-red-500
                        px-2
                      "
                      onClick={() =>
                        handleDeletePdf(
                          pdf
                        )
                      }
                    >
                      삭제
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}