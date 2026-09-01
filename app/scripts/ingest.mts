/**
 * 공공데이터 복지서비스 색인 실행기
 *
 *   npm run ingest
 *
 * 인증키가 없으면 왜 건너뛰는지 알려주고 정상 종료한다.
 * 색인 결과는 src/data/programs.generated.json 에 쓴다.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { ingestCentral } from "../src/lib/kb/ingest.ts";

const report = await ingestCentral({ limit: Number(process.env.INGEST_LIMIT ?? 300) });

if (!report.ok) {
  console.log("\n색인을 건너뜁니다.");
  console.log(report.skippedReason);
  console.log("\n시드 지식베이스(src/lib/kb/programs.ts)로 서비스는 그대로 동작합니다.\n");
  process.exit(0);
}

mkdirSync("src/data", { recursive: true });
writeFileSync(
  "src/data/programs.generated.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), programs: report.programs }, null, 2),
  "utf8",
);

console.log(`\n가져온 항목        ${report.fetched}`);
console.log(`돌봄 관련으로 채택 ${report.normalized}`);
console.log(`제외              ${report.dropped.length}`);
console.log("\nsrc/data/programs.generated.json 에 저장했습니다.");
console.log('색인된 항목은 전부 verified: "needs-check" 입니다 — 원문 대조 전이라 금액 합계에 넣지 않습니다.\n');
