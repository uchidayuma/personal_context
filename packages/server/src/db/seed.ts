import type { Db } from '../types.js'
import { questions, questionTranslations } from './schema.js'

const SEED_QUESTIONS = [
  { id: 'q01', category: 'childhood',    content: '子供の頃、何をするのが一番好きでしたか？',         priority: 10 },
  { id: 'q02', category: 'childhood',    content: '幼少期に最も影響を受けた人物は誰ですか？',          priority: 9  },
  { id: 'q03', category: 'childhood',    content: '子供の頃の夢は何でしたか？',                        priority: 8  },
  { id: 'q04', category: 'education',    content: '学生時代に最も熱中したことは何ですか？',             priority: 10 },
  { id: 'q05', category: 'education',    content: 'あなたの人生で転機となった学びの経験を教えてください。', priority: 9 },
  { id: 'q06', category: 'education',    content: '今も記憶に残っている先生や恩師はいますか？',        priority: 7  },
  { id: 'q07', category: 'career',       content: '最初の仕事はどのようなものでしたか？',               priority: 10 },
  { id: 'q08', category: 'career',       content: 'キャリアの中で最も誇りに思う成果は何ですか？',      priority: 10 },
  { id: 'q09', category: 'career',       content: '仕事を選ぶときに最も重視することは何ですか？',      priority: 9  },
  { id: 'q10', category: 'career',       content: '仕事で最も辛かった経験は何ですか？',                priority: 8  },
  { id: 'q11', category: 'values',       content: '人生で最も大切にしている価値観は何ですか？',        priority: 10 },
  { id: 'q12', category: 'values',       content: '自分が絶対に譲れないことは何ですか？',              priority: 9  },
  { id: 'q13', category: 'values',       content: '失敗から学んだ最も大きな教訓は何ですか？',          priority: 8  },
  { id: 'q14', category: 'values',       content: 'お金と時間のどちらを優先しますか？その理由は？',    priority: 7  },
  { id: 'q15', category: 'goals',        content: '5年後にどのような状態でいたいですか？',              priority: 10 },
  { id: 'q16', category: 'goals',        content: '死ぬまでに必ず達成したいことは何ですか？',          priority: 9  },
  { id: 'q17', category: 'goals',        content: '今、最も力を入れていることは何ですか？',            priority: 10 },
  { id: 'q18', category: 'skills',       content: '自分が最も得意とすることは何ですか？',              priority: 9  },
  { id: 'q19', category: 'skills',       content: 'これから身につけたいと思っているスキルは何ですか？', priority: 8 },
  { id: 'q20', category: 'life_events',  content: '人生で最も嬉しかった出来事を教えてください。',      priority: 9  },
  { id: 'q21', category: 'life_events',  content: '人生で最も困難だった時期はいつですか？',            priority: 8  },
  { id: 'q22', category: 'life_events',  content: 'あなたの考え方を大きく変えた出来事は何ですか？',    priority: 9  },
  { id: 'q23', category: 'relationships', content: 'あなたの人生に最も大きな影響を与えた人物を教えてください。', priority: 8 },
  { id: 'q24', category: 'relationships', content: '理想とする人間関係や友人像はどのようなものですか？', priority: 7 },

  // L2: 気質・性格
  { id: 'q25', category: 'character', content: '子供の頃から「昔からそういう人だね」と言われてきたことはありますか？', priority: 8 },
  { id: 'q26', category: 'character', content: '決断を迫られたとき、最終的に「体」が先に答えを出すことがありますか？どんな感覚ですか？', priority: 7 },
  { id: 'q27', category: 'character', content: '他の人が平気なのに、自分だけがどうしても嫌だと感じることはありますか？', priority: 8 },

  // L5: 関係性パターン
  { id: 'q28', category: 'relationships', content: '今まで「この人とは合わなかった」と感じた人には、共通点がありましたか？', priority: 7 },
  { id: 'q29', category: 'relationships', content: '自然と長く付き合いが続く人と、なぜか疎遠になってしまう人の違いは何だと思いますか？', priority: 7 },
  { id: 'q42', category: 'relationships', content: '一緒にいると自然とエネルギーが湧いてくる人は、どんな特徴を持っていますか？', priority: 8 },
  { id: 'q43', category: 'relationships', content: '信頼できる人かどうかを判断するとき、どんなことを見ていますか？', priority: 8 },
  { id: 'q44', category: 'relationships', content: '過去に「この人がいなかったら今の自分はなかった」と思う人はいますか？どんな関わりでしたか？', priority: 9 },

  // L6: 意見・スタンス
  { id: 'q30', category: 'opinions', content: '「世の中的には正しいとされているけど、自分は懐疑的だ」と思っていることはありますか？', priority: 8 },
  { id: 'q31', category: 'opinions', content: '今の仕事や業界で「これは過大評価されている」と思うものがあれば教えてください。', priority: 7 },
  { id: 'q32', category: 'opinions', content: '会議・採用・評価など、職場の慣行で「これは本当に必要なのか」と思ったことはありますか？', priority: 7 },

  // L7: 恐れ・回避（間接的アプローチ）
  { id: 'q33', category: 'fears', content: '声をかけられたのに断ったこと、または最後まで踏み込めなかったことはありますか？そのときどんな気持ちでしたか？', priority: 8 },
  { id: 'q34', category: 'fears', content: '「絶対にこういう立場や状況にはなりたくない」と強く思った経験はありますか？', priority: 9 },
  { id: 'q35', category: 'fears', content: '誰かや何かの「なれの果て」を見て、こうなりたくないと思ったことはありますか？', priority: 8 },

  // L8: 繰り返す癖（間接的アプローチ）
  { id: 'q36', category: 'patterns', content: '仕事でもプライベートでも「またこのパターンになってしまった」と気づいたことはありますか？', priority: 9 },
  { id: 'q37', category: 'patterns', content: '人間関係で繰り返してきた「困ったな」というパターンがあれば教えてください。', priority: 8 },
  { id: 'q38', category: 'patterns', content: '締め切り・プレッシャー・対立が生じたとき、自分はどう反応することが多いですか？', priority: 8 },

  // L10: 好み・スタイル
  { id: 'q39', category: 'preferences', content: '仕事の進め方で「これが自分のリズムだ」と感じるやり方はありますか？', priority: 8 },
  { id: 'q40', category: 'preferences', content: '他の人のプレゼンや文章で「読みやすい・伝わりやすい」と感じるのはどういうスタイルですか？', priority: 7 },
  { id: 'q41', category: 'preferences', content: '一番集中できる環境・時間帯・状況を教えてください。', priority: 7 },

  // 追加質問: 身体感覚・場面・対比の切り口
  { id: 'q45', category: 'values', content: '最近、自分らしく動けたなと感じた瞬間はありますか？そのとき体はどんな感じでしたか？', priority: 9 },
  { id: 'q46', category: 'values', content: '「これだけは妥協できない」と体が拒否反応を示したことはありますか？', priority: 8 },
  { id: 'q47', category: 'goals', content: '今やっていることの中で、時間を忘れて没頭してしまうものはありますか？', priority: 9 },
  { id: 'q48', category: 'goals', content: '誰にも頼まれていないのに、気づいたら考えたり調べたりしていることはありますか？', priority: 8 },
  { id: 'q49', category: 'career', content: '仕事中に「あ、これ好きだな」と体が前のめりになった瞬間を覚えていますか？', priority: 9 },
  { id: 'q50', category: 'career', content: '同じ成果でも、やり方によって体の重さが全然違うことがありますか？どんな違いですか？', priority: 8 },
  { id: 'q51', category: 'life_events', content: '「あのとき行動して本当によかった」と今でも思い出す決断はありますか？', priority: 8 },
  { id: 'q52', category: 'life_events', content: '環境が変わった瞬間、体が軽くなった（or 重くなった）経験はありますか？', priority: 8 },
  { id: 'q53', category: 'character', content: 'ストレスがかかったとき、体のどこに一番先に出ますか？', priority: 7 },
  { id: 'q54', category: 'character', content: '「考える前に体が動いてしまう」タイプですか？それとも「頭で納得しないと動けない」タイプですか？', priority: 8 },
  { id: 'q55', category: 'opinions', content: '周りが「効率的」と言っているやり方が、自分には逆に遠回りに感じることはありますか？', priority: 7 },
  { id: 'q56', category: 'opinions', content: '「これは本質じゃない」と感じるのに、なぜかみんなが重視していることはありますか？', priority: 8 },
  { id: 'q57', category: 'fears', content: '過去に「安全な選択」をしたのに、なぜか後悔している決断はありますか？', priority: 8 },
  { id: 'q58', category: 'patterns', content: 'お金・時間・人間関係で、同じ失敗を繰り返してしまうパターンはありますか？', priority: 8 },
  { id: 'q59', category: 'skills', content: '他の人が苦労することを、自分は自然にできてしまうことはありますか？', priority: 9 },
  { id: 'q60', category: 'education', content: '学校で習ったことより、独学で学んだことの方が役に立っていると感じますか？', priority: 7 },
]

const EN_TRANSLATIONS: { questionId: string; content: string }[] = [
  { questionId: 'q01', content: 'What did you enjoy doing most as a child?' },
  { questionId: 'q02', content: 'Who had the greatest influence on you during your childhood?' },
  { questionId: 'q03', content: 'What did you dream of becoming when you were a child?' },
  { questionId: 'q04', content: 'What were you most passionate about during your school years?' },
  { questionId: 'q05', content: 'Tell me about a learning experience that was a turning point in your life.' },
  { questionId: 'q06', content: 'Is there a teacher or mentor who still stands out in your memory?' },
  { questionId: 'q07', content: 'What was your first job like?' },
  { questionId: 'q08', content: 'What achievement in your career are you most proud of?' },
  { questionId: 'q09', content: 'What do you value most when choosing work?' },
  { questionId: 'q10', content: 'What was the most difficult experience you\'ve had at work?' },
  { questionId: 'q11', content: 'What values do you hold most dear in life?' },
  { questionId: 'q12', content: 'What is something you absolutely will not compromise on?' },
  { questionId: 'q13', content: 'What is the biggest lesson you\'ve learned from failure?' },
  { questionId: 'q14', content: 'Do you prioritize money or time? Why?' },
  { questionId: 'q15', content: 'Where would you like to be in five years?' },
  { questionId: 'q16', content: 'What is something you absolutely want to achieve before you die?' },
  { questionId: 'q17', content: 'What are you putting the most energy into right now?' },
  { questionId: 'q18', content: 'What are you best at?' },
  { questionId: 'q19', content: 'What skills are you hoping to develop going forward?' },
  { questionId: 'q20', content: 'Tell me about the happiest moment of your life.' },
  { questionId: 'q21', content: 'When was the most difficult period of your life?' },
  { questionId: 'q22', content: 'What event most significantly changed the way you think?' },
  { questionId: 'q23', content: 'Who has had the greatest influence on your life?' },
  { questionId: 'q24', content: 'What does your ideal relationship or friendship look like?' },
  { questionId: 'q25', content: 'Have people been telling you "that\'s just how you are" since childhood?' },
  { questionId: 'q26', content: 'When forced to make a decision, does your body sometimes give you the answer before your head does? What does that feel like?' },
  { questionId: 'q27', content: 'Is there something that others seem fine with but that you genuinely can\'t stand?' },
  { questionId: 'q28', content: 'Looking back at people you\'ve worked or lived with, were there common traits among those who just didn\'t click with you?' },
  { questionId: 'q29', content: 'What\'s the difference between people you naturally stay close to over the years, and those you drift apart from?' },
  { questionId: 'q42', content: 'What traits do people who energize you naturally tend to have?' },
  { questionId: 'q43', content: 'What do you look for when deciding whether someone is trustworthy?' },
  { questionId: 'q44', content: 'Is there someone without whom you feel you wouldn\'t be who you are today? What was your relationship like?' },
  { questionId: 'q30', content: 'Is there something widely accepted as right or true that you\'re quietly skeptical about?' },
  { questionId: 'q31', content: 'In your work or field, is there something you think is overrated or overhyped?' },
  { questionId: 'q32', content: 'Have you ever thought about a common workplace practice — meetings, hiring, reviews — and wondered if it\'s really necessary?' },
  { questionId: 'q33', content: 'Have you ever been invited into something but stepped back — or got close and couldn\'t quite go through with it? What was going on for you then?' },
  { questionId: 'q34', content: 'Has there been a situation or role you felt very strongly you never wanted to be in?' },
  { questionId: 'q35', content: 'Have you ever seen what someone or something became over time and felt strongly: I don\'t want to end up like that?' },
  { questionId: 'q36', content: 'Have you ever caught yourself thinking "here I go again" — a pattern repeating across work and personal life?' },
  { questionId: 'q37', content: 'Is there a recurring pattern in your relationships that you\'ve found difficult or frustrating?' },
  { questionId: 'q38', content: 'When deadlines, pressure, or conflict come up, how do you tend to respond?' },
  { questionId: 'q39', content: 'Do you have a rhythm or way of working that feels distinctly yours?' },
  { questionId: 'q40', content: 'When someone else\'s presentation or writing feels easy to follow, what is it about their style that works for you?' },
  { questionId: 'q41', content: 'What environment, time of day, or situation helps you concentrate best?' },
  { questionId: 'q45', content: 'Can you recall a recent moment when you felt like you were truly being yourself? How did your body feel?' },
  { questionId: 'q46', content: 'Has there been something your body simply refused to compromise on?' },
  { questionId: 'q47', content: 'Is there anything you do now where you lose track of time completely?' },
  { questionId: 'q48', content: 'Is there something you find yourself thinking about or researching even though nobody asked you to?' },
  { questionId: 'q49', content: 'Do you remember a moment at work when you thought "oh, I actually like this" and leaned in?' },
  { questionId: 'q50', content: 'Have you noticed that the same outcome can feel completely different in your body depending on how you got there?' },
  { questionId: 'q51', content: 'Is there a decision you made that you still think back on and feel glad you went for it?' },
  { questionId: 'q52', content: 'Have you ever felt your body get lighter (or heavier) the moment your environment changed?' },
  { questionId: 'q53', content: 'When you\'re stressed, where in your body do you feel it first?' },
  { questionId: 'q54', content: 'Do you tend to move before thinking, or do you need to understand something in your head before you act?' },
  { questionId: 'q55', content: 'Is there a method others call "efficient" that actually feels like a detour to you?' },
  { questionId: 'q56', content: 'Is there something everyone else seems to prioritize that you feel isn\'t really the point?' },
  { questionId: 'q57', content: 'Have you ever made the "safe choice" and ended up regretting it anyway?' },
  { questionId: 'q58', content: 'Is there a pattern you keep repeating with money, time, or relationships — even though you know better?' },
  { questionId: 'q59', content: 'Is there something others struggle with that comes naturally to you?' },
  { questionId: 'q60', content: 'Do you feel that what you taught yourself has been more useful than what you learned in school?' },
]

export async function seedQuestions(targetDb: Db) {
  await targetDb.insert(questions).values(SEED_QUESTIONS).onConflictDoNothing()
  await targetDb.insert(questionTranslations).values(
    EN_TRANSLATIONS.map(t => ({ ...t, language: 'en' }))
  ).onConflictDoNothing()
}
