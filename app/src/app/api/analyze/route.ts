import { analyze, type AnalyzeInput } from "@/lib/engine/analyze";
import { getPreset } from "@/lib/presets";

/**
 * 분석 실행.
 * 이 라우트에는 LLM이 개입하지 않는다. 전부 결정론적 계산이다.
 * 같은 입력이면 항상 같은 출력 — 감사 가능성의 전제.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    let input: AnalyzeInput;
    if (body.presetId) {
      const preset = getPreset(body.presetId);
      if (!preset) {
        return Response.json({ error: "존재하지 않는 프리셋입니다." }, { status: 400 });
      }
      input = preset.input;
    } else if (body.input) {
      input = body.input as AnalyzeInput;
    } else {
      return Response.json({ error: "presetId 또는 input이 필요합니다." }, { status: 400 });
    }

    const result = analyze(input);
    return Response.json({ ok: true, input, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
