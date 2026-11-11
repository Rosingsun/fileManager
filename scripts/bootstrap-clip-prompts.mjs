/**
 * 兼容入口：旧版本该脚本生成的是确定性伪嵌入（PLACEHOLDER），会让零样本分类接近随机猜。
 * 现在统一委托给真实 CLIP 文本编码器，避免误用后覆盖掉真实向量。
 *
 * 用法：node scripts/bootstrap-clip-prompts.mjs [all|b32|l14]
 * 等价于：npm run gen:clip-prompts
 */
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const here = dirname(fileURLToPath(import.meta.url))
const generator = join(here, '_clip_text_gen', 'generate-prompts.mjs')
const requested = process.argv[2]
const model = ['all', 'b32', 'l14'].includes(requested) ? requested : 'all'

console.warn('[clip-prompts] 已切换到真实 CLIP 文本编码器（旧脚本的伪嵌入已废弃）')
const result = spawnSync(process.execPath, [generator, '--model', model], { stdio: 'inherit' })
process.exit(result.status ?? 1)
