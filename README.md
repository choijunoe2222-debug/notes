# NOTEFORM

AI 답변을 A4 2단 PDF로 변환하는 개인용 Next.js 앱입니다. 미리보기는 다운로드와 동일한 PDF 파일입니다. 내용 수정 후에는 다시 생성해야 합니다.

## 실행

Node.js 20.9 이상과 Chrome이 필요합니다.

```bash
npm.cmd ci
npm.cmd run dev
```

`http://localhost:3000`을 열면 됩니다. 접근 코드를 사용하려면 `.env.example`을 `.env.local`로 복사하고 `APP_ACCESS_CODE`를 설정하세요. 값이 없으면 인증 화면 없이 실행됩니다.

## 지원 입력

- 일반 Markdown 문단, 목록, 굵은 글씨, 코드
- Markdown 제목(`#`, `##`), 파이프 표, 인용 상자(`>`)
- `\\[ ... \\]`, `\\( ... \\)`, `$$ ... $$`, `$ ... $` LaTeX 수식
- `핵심 정리:`, `반드시 알아야 할 내용:`, `헷갈리기 쉬운 부분:` 등의 강조 박스
- 일반 괄호, 공백, 코드 블록 안의 문자 그림은 수식으로 추측하지 않습니다.
- HTML 붙여넣기는 Markdown으로 변환하며, 클립보드에 포함된 TeX annotation을 우선 보존합니다. 최근 붙여넣기의 원본 텍스트와 HTML은 별도로 저장할 수 있습니다.
- 닫히지 않거나 지원하지 않는 수식은 원문과 경고를 남깁니다. 외부 이미지는 서버가 임의의 주소를 가져오지 않도록 설명과 주소로 보존합니다.
- 너무 넓어 읽을 수 없는 도표는 잘린 PDF를 반환하는 대신 분할을 요청합니다. 클립보드에 없는 이미지·수식 정보까지 복구할 수는 없습니다.

## 배포

Vercel에 프로젝트를 연결하고 `APP_ACCESS_CODE` 환경 변수를 설정합니다. PDF API는 `puppeteer-core`와 서버리스 Chromium을 사용하며 최대 실행 시간은 60초입니다. 입력 본문은 DB나 파일에 저장하지 않습니다. 브라우저의 마지막 초안만 `localStorage`에 저장됩니다.

## 검증

```bash
npm run lint
npm run build
npm run test:pdf
```

`test:pdf`는 실제 변환 모듈을 사용해 괄호·코드 원문 보존, 한글 수식 상자, 표, 오류 수식 대체, 너비 초과 방지를 검사합니다. `tmp/pdfs/regression/compatibility.pdf`를 생성하므로 수식/폰트/Chromium을 변경할 때 페이지 이미지도 확인하세요. Windows에서는 위 명령의 `npm`을 `npm.cmd`로 실행할 수 있습니다.

MathJax와 한국어 글꼴은 고정 버전으로 설치하고 서버에 포함합니다. PDF 생성 중 CDN이나 외부 글꼴에 의존하지 않습니다. 배포 빌드에서 Chromium·MathJax·폰트 파일 누락을 검사합니다.
