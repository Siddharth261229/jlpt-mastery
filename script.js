/* ==========================================================================
   TSUZURI — JLPT N5–N3 MASTERY HUB
   Pure vanilla JS. No build step, no dependencies.

   This is a MODIFICATION of the original single-mode explorer build. Kept
   unchanged from before: the kana/romaji conversion utility, the curated
   sentence bank, and the kanjiapi.dev / jisho.org API layer. Rebuilt: the
   whole state/rendering/event layer, now organised around a persistent
   3-state learning status per item, a progress dashboard, a flip-card
   flashcard mode, and a multiple-choice quiz engine.

   Sections:
     1. Kana <-> Romaji conversion utility            (unchanged)
     2. Curated multi-format sentence bank             (unchanged)
     2b. Curated grammar point bank                    (NEW)
     3. Global state + localStorage status/data system (REWRITTEN)
     4. API layer (kanjiapi.dev + jisho.org)            (unchanged, integrated
                                                          with the new level-
                                                          list cache)
     5. Rendering helpers (cards, modal, sentence lines)(REWRITTEN)
     6. Flashcard flip mode                             (NEW)
     7. Practice quiz engine                            (NEW)
     8. Export / Import progress                        (NEW)
     9. Event wiring / app bootstrap                    (REWRITTEN)
   ========================================================================== */

(() => {
  "use strict";

  /* ========================================================================
     1. KANA <-> ROMAJI CONVERSION UTILITY  (unchanged from the original build)
     ======================================================================== */

  const KANA = {
    あ: "a",
    い: "i",
    う: "u",
    え: "e",
    お: "o",
    か: "ka",
    き: "ki",
    く: "ku",
    け: "ke",
    こ: "ko",
    が: "ga",
    ぎ: "gi",
    ぐ: "gu",
    げ: "ge",
    ご: "go",
    さ: "sa",
    し: "shi",
    す: "su",
    せ: "se",
    そ: "so",
    ざ: "za",
    じ: "ji",
    ず: "zu",
    ぜ: "ze",
    ぞ: "zo",
    た: "ta",
    ち: "chi",
    つ: "tsu",
    て: "te",
    と: "to",
    だ: "da",
    ぢ: "ji",
    づ: "zu",
    で: "de",
    ど: "do",
    な: "na",
    に: "ni",
    ぬ: "nu",
    ね: "ne",
    の: "no",
    は: "ha",
    ひ: "hi",
    ふ: "fu",
    へ: "he",
    ほ: "ho",
    ば: "ba",
    び: "bi",
    ぶ: "bu",
    べ: "be",
    ぼ: "bo",
    ぱ: "pa",
    ぴ: "pi",
    ぷ: "pu",
    ぺ: "pe",
    ぽ: "po",
    ま: "ma",
    み: "mi",
    む: "mu",
    め: "me",
    も: "mo",
    や: "ya",
    ゆ: "yu",
    よ: "yo",
    ら: "ra",
    り: "ri",
    る: "ru",
    れ: "re",
    ろ: "ro",
    わ: "wa",
    ゐ: "i",
    ゑ: "e",
    を: "o",
    ん: "n",
    ぁ: "a",
    ぃ: "i",
    ぅ: "u",
    ぇ: "e",
    ぉ: "o",
    ゔ: "vu",
  };

  const YOUON = {
    きゃ: "kya",
    きゅ: "kyu",
    きょ: "kyo",
    ぎゃ: "gya",
    ぎゅ: "gyu",
    ぎょ: "gyo",
    しゃ: "sha",
    しゅ: "shu",
    しょ: "sho",
    じゃ: "ja",
    じゅ: "ju",
    じょ: "jo",
    ちゃ: "cha",
    ちゅ: "chu",
    ちょ: "cho",
    ぢゃ: "ja",
    ぢゅ: "ju",
    ぢょ: "jo",
    にゃ: "nya",
    にゅ: "nyu",
    にょ: "nyo",
    ひゃ: "hya",
    ひゅ: "hyu",
    ひょ: "hyo",
    びゃ: "bya",
    びゅ: "byu",
    びょ: "byo",
    ぴゃ: "pya",
    ぴゅ: "pyu",
    ぴょ: "pyo",
    みゃ: "mya",
    みゅ: "myu",
    みょ: "myo",
    りゃ: "rya",
    りゅ: "ryu",
    りょ: "ryo",
  };

  function katakanaToHiragana(str) {
    return str.replace(/[\u30A1-\u30F6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60),
    );
  }

  function hiraganaToKatakana(str) {
    return str.replace(/[\u3041-\u3096]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) + 0x60),
    );
  }

  function toRomaji(str) {
    const s = katakanaToHiragana(str);
    let out = "";
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "ー") {
        const m = out.match(/[aeiou](?!.*[aeiou])/);
        out += m ? m[0] : "";
        continue;
      }
      if (ch === "っ") {
        const two = s.substr(i + 1, 2);
        const one = s.substr(i + 1, 1);
        const nextRomaji = YOUON[two] || KANA[one] || "";
        if (nextRomaji.startsWith("ch")) out += "t";
        else if (nextRomaji) out += nextRomaji[0];
        continue;
      }
      const two = s.substr(i, 2);
      if (YOUON[two]) {
        out += YOUON[two];
        i++;
        continue;
      }
      if (KANA[ch]) {
        out += KANA[ch];
        continue;
      }
      out += ch;
    }
    return out;
  }

  /** Romanize a sentence word-by-word and join with spaces. Sentences are
   *  stored as an array of hiragana "segments" (words/particles, with any
   *  trailing 、or。attached to the segment that precedes it) rather than
   *  one long string — there's no morphological analyzer in this vanilla-JS
   *  build to find word boundaries automatically, so the boundaries are
   *  supplied once as data and the romaji itself is still generated purely
   *  by the conversion utility above, segment by segment. Full-width 、/。
   *  are swapped for , / . once the whole line is assembled, for a more
   *  natural-reading romaji line. */
  function toRomajiSentence(segments) {
    return segments
      .map((seg) => {
        // Now that word boundaries are explicit data (not guessed), the
        // classic Hepburn particle exceptions can be applied correctly:
        // は as the topic particle romanizes "wa", へ as the direction
        // particle romanizes "e" — but only when they stand alone as their
        // own segment, never when they're part of a longer word.
        if (seg === "は") return "wa";
        if (seg === "へ") return "e";
        return toRomaji(seg);
      })
      .join(" ")
      .replace(/、/g, ",")
      .replace(/。/g, ".")
      .replace(/\s+([,.])/g, "$1")
      .trim();
  }

  function extractKanjiChars(str) {
    const matches = str.match(/[\u4E00-\u9FFF]/g) || [];
    return [...new Set(matches)];
  }

  function escapeHtml(str) {
    return String(str).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  function debounce(fn, delay = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Sample up to n distinct, truthy, de-duplicated values from an array. */
  function sampleDistinct(arr, n) {
    const unique = [...new Set(arr.filter(Boolean))];
    return shuffleArray(unique).slice(0, n);
  }

  /* ========================================================================
     2. CURATED MULTI-FORMAT SENTENCE BANK  (unchanged from the original build)
     ======================================================================== */

  const SENTENCES_RAW = [
    {
      kanjiKana: "私は学生です。",
      segments: ["わたし", "は", "がくせい", "です。"],
      english: "I am a student.",
    },
    {
      kanjiKana: "今日は忙しいです。",
      segments: ["きょう", "は", "いそがしい", "です。"],
      english: "I am busy today.",
    },
    {
      kanjiKana: "毎朝六時に起きます。",
      segments: ["まいあさ", "ろくじ", "に", "おきます。"],
      english: "I get up at six every morning.",
    },
    {
      kanjiKana: "学校まで歩いて行きます。",
      segments: ["がっこう", "まで", "あるいて", "いきます。"],
      english: "I walk to school.",
    },
    {
      kanjiKana: "昨日、友達と映画を見ました。",
      segments: ["きのう、", "ともだち", "と", "えいが", "を", "みました。"],
      english: "Yesterday I watched a movie with a friend.",
    },
    {
      kanjiKana: "日本語を勉強しています。",
      segments: ["にほんご", "を", "べんきょう", "して", "います。"],
      english: "I am studying Japanese.",
    },
    {
      kanjiKana: "明日、病院へ行かなければなりません。",
      segments: ["あした", "びょういん", "へ", "いかなければ", "なりません。"],
      english: "I have to go to the hospital tomorrow.",
    },
    {
      kanjiKana: "この漢字の読み方が分かりません。",
      segments: ["この", "かんじ", "の", "よみかた", "が", "わかりません。"],
      english: "I don't know how to read this kanji.",
    },
    {
      kanjiKana: "電車の中で本を読みます。",
      segments: ["でんしゃ", "の", "なか", "で", "ほん", "を", "よみます。"],
      english: "I read a book on the train.",
    },
    {
      kanjiKana: "彼女は毎日日記を書きます。",
      segments: ["かのじょ", "は", "まいにち", "にっき", "を", "かきます。"],
      english: "She writes a diary every day.",
    },
    {
      kanjiKana: "新しい単語を覚えました。",
      segments: ["あたらしい", "たんご", "を", "おぼえました。"],
      english: "I memorized new vocabulary.",
    },
    {
      kanjiKana: "今晩、家族と晩ご飯を食べます。",
      segments: [
        "こんばん、",
        "かぞく",
        "と",
        "ばんごはん",
        "を",
        "たべます。",
      ],
      english: "Tonight I'll eat dinner with my family.",
    },
    {
      kanjiKana: "冷たい水を飲みたいです。",
      segments: ["つめたい", "みず", "を", "のみたいです。"],
      english: "I want to drink cold water.",
    },
    {
      kanjiKana: "会議は九時に始まります。",
      segments: ["かいぎ", "は", "くじ", "に", "はじまります。"],
      english: "The meeting starts at nine.",
    },
    {
      kanjiKana: "仕事はもう終わりました。",
      segments: ["しごと", "は", "もう", "おわりました。"],
      english: "Work has already finished.",
    },
    {
      kanjiKana: "友達に手紙を送りました。",
      segments: ["ともだち", "に", "てがみ", "を", "おくりました。"],
      english: "I sent a letter to my friend.",
    },
    {
      kanjiKana: "すみません、窓を開けてもいいですか。",
      segments: ["すみません、", "まど", "を", "あけても", "いいですか。"],
      english: "Excuse me, may I open the window?",
    },
    {
      kanjiKana: "寒いのでドアを閉めてください。",
      segments: ["さむいので", "どあ", "を", "しめてください。"],
      english: "Please close the door because it's cold.",
    },
    {
      kanjiKana: "週末は家でゆっくり休みます。",
      segments: ["しゅうまつ", "は", "いえ", "で", "ゆっくり", "やすみます。"],
      english: "I rest quietly at home on weekends.",
    },
    {
      kanjiKana: "母は毎日料理を作ります。",
      segments: ["ははは", "まいにち", "りょうり", "を", "つくります。"],
      english: "My mother cooks every day.",
    },
    {
      kanjiKana: "駅までタクシーを使いました。",
      segments: ["えき", "まで", "たくしー", "を", "つかいました。"],
      english: "I used a taxi to get to the station.",
    },
    {
      kanjiKana: "新しい仕事を選びました。",
      segments: ["あたらしい", "しごと", "を", "えらびました。"],
      english: "I chose a new job.",
    },
    {
      kanjiKana: "来月、日本へ出発します。",
      segments: ["らいげつ、", "にほん", "へ", "しゅっぱつします。"],
      english: "I will depart for Japan next month.",
    },
    {
      kanjiKana: "空港に十時に到着しました。",
      segments: ["くうこう", "に", "じゅうじ", "に", "とうちゃくしました。"],
      english: "I arrived at the airport at ten o'clock.",
    },
    {
      kanjiKana: "彼は来年、大学を卒業します。",
      segments: [
        "かれ",
        "は",
        "らいねん、",
        "だいがく",
        "を",
        "そつぎょうします。",
      ],
      english: "He will graduate from university next year.",
    },
    {
      kanjiKana: "兄は銀行に就職しました。",
      segments: ["あに", "は", "ぎんこう", "に", "しゅうしょくしました。"],
      english: "My older brother got a job at a bank.",
    },
    {
      kanjiKana: "二人は先月結婚しました。",
      segments: ["ふたり", "は", "せんげつ", "けっこんしました。"],
      english: "The two got married last month.",
    },
    {
      kanjiKana: "先生が文法を説明してくれました。",
      segments: [
        "せんせい",
        "が",
        "ぶんぽう",
        "を",
        "せつめいして",
        "くれました。",
      ],
      english: "The teacher explained the grammar for me.",
    },
    {
      kanjiKana: "分からないことを質問しました。",
      segments: ["わからない", "こと", "を", "しつもんしました。"],
      english: "I asked about things I didn't understand.",
    },
    {
      kanjiKana: "旅行の準備をしています。",
      segments: ["りょこう", "の", "じゅんび", "を", "しています。"],
      english: "I am preparing for the trip.",
    },
    {
      kanjiKana: "子供のころ、よく公園で遊びました。",
      segments: [
        "こども",
        "の",
        "ころ、",
        "よく",
        "こうえん",
        "で",
        "あそびました。",
      ],
      english: "As a child, I often played in the park.",
    },
    {
      kanjiKana: "毎晩、日記をつけることに決めました。",
      segments: [
        "まいばん、",
        "にっき",
        "を",
        "つける",
        "ことに",
        "きめました。",
      ],
      english: "I decided to keep a diary every night.",
    },
    {
      kanjiKana: "図書館で静かに勉強します。",
      segments: ["としょかん", "で", "しずかに", "べんきょうします。"],
      english: "I study quietly in the library.",
    },
    {
      kanjiKana: "彼女は英語をぺらぺら話します。",
      segments: ["かのじょ", "は", "えいご", "を", "ぺらぺら", "はなします。"],
      english: "She speaks English fluently.",
    },
    {
      kanjiKana: "今度の試験は難しいと思います。",
      segments: [
        "こんど",
        "の",
        "しけん",
        "は",
        "むずかしい",
        "と",
        "おもいます。",
      ],
      english: "I think the next exam will be difficult.",
    },
    {
      kanjiKana: "病気のとき、薬を飲みます。",
      segments: ["びょうき", "の", "とき、", "くすり", "を", "のみます。"],
      english: "When I'm sick, I take medicine.",
    },
    {
      kanjiKana: "台風のニュースが心配です。",
      segments: ["たいふう", "の", "にゅーす", "が", "しんぱいです。"],
      english: "The typhoon news worries me.",
    },
    {
      kanjiKana: "経験がないので、頑張ります。",
      segments: ["けいけん", "が", "ないので、", "がんばります。"],
      english: "Since I have no experience, I'll do my best.",
    },
    {
      kanjiKana: "図書館の本を返さなければなりません。",
      segments: [
        "としょかん",
        "の",
        "ほん",
        "を",
        "かえさなければ",
        "なりません。",
      ],
      english: "I have to return the library book.",
    },
    {
      kanjiKana: "友達にペンを貸してもらいました。",
      segments: ["ともだち", "に", "ぺん", "を", "かしてもらいました。"],
      english: "A friend lent me a pen.",
    },
    {
      kanjiKana: "電気を利用して料理を作ります。",
      segments: [
        "でんき",
        "を",
        "りようして",
        "りょうり",
        "を",
        "つくります。",
      ],
      english: "I use electricity to cook.",
    },
    {
      kanjiKana: "毎日運動を続けています。",
      segments: ["まいにち", "うんどう", "を", "つづけています。"],
      english: "I continue exercising every day.",
    },
    {
      kanjiKana: "忘れ物をしないように気をつけます。",
      segments: ["わすれもの", "を", "しないように", "き", "を", "つけます。"],
      english: "I'll be careful not to forget things.",
    },
  ];

  /** Every sentence stores its hiragana as an array of word/particle
   *  "segments" (see toRomajiSentence above). The Furigana and Katakana
   *  lines need one continuous string, so it's derived here once, keeping
   *  a single source of truth instead of maintaining two copies by hand. */
  const SENTENCES = SENTENCES_RAW.map((s) => ({
    ...s,
    hiragana: s.segments.join(""),
  }));

  function getSentencesFor(keyword) {
    if (!keyword) return [];
    return SENTENCES.filter((s) => s.kanjiKana.includes(keyword));
  }

  /* ========================================================================
     2b. CURATED GRAMMAR POINT BANK  (NEW)
     Small, fixed set per level so it can contribute a finite denominator
     to the progress dashboard, the same way the kanji list does. Each
     point carries its own worked example in the same {kanjiKana, hiragana,
     english} shape as the sentence bank, so it plugs straight into the
     five-line Sentence Engine.
     ======================================================================== */

  const GRAMMAR_POINTS_RAW = {
    n5: [
      {
        pattern: "〜は〜です",
        meaning: "X is Y (topic + copula)",
        explanation:
          "The most basic sentence pattern: state that topic は is equal to Y です.",
        example: {
          kanjiKana: "これは本です。",
          segments: ["これ", "は", "ほん", "です。"],
          english: "This is a book.",
        },
      },
      {
        pattern: "〜を",
        meaning: "marks the direct object",
        explanation:
          "Attach を to the noun that receives the action of the verb.",
        example: {
          kanjiKana: "パンを食べます。",
          segments: ["ぱん", "を", "たべます。"],
          english: "I eat bread.",
        },
      },
      {
        pattern: "〜に行きます",
        meaning: "go to ~",
        explanation:
          "に marks the destination before a motion verb like 行きます.",
        example: {
          kanjiKana: "学校に行きます。",
          segments: ["がっこう", "に", "いきます。"],
          english: "I go to school.",
        },
      },
      {
        pattern: "〜たいです",
        meaning: "want to do ~",
        explanation:
          "Attach たい to a verb's stem to express your own desire to do something.",
        example: {
          kanjiKana: "水が飲みたいです。",
          segments: ["みず", "が", "のみたいです。"],
          english: "I want to drink water.",
        },
      },
      {
        pattern: "〜ないでください",
        meaning: "please don't do ~",
        explanation:
          "Use the negative て-form (ない) plus でください to request someone not do something.",
        example: {
          kanjiKana: "ここで写真を撮らないでください。",
          segments: ["ここで", "しゃしん", "を", "とらないでください。"],
          english: "Please don't take photos here.",
        },
      },
      {
        pattern: "〜ましょう",
        meaning: "let's do ~",
        explanation:
          "A polite volitional form inviting someone to do something together.",
        example: {
          kanjiKana: "一緒に行きましょう。",
          segments: ["いっしょに", "いきましょう。"],
          english: "Let's go together.",
        },
      },
    ],
    n4: [
      {
        pattern: "〜ようになる",
        meaning: "come to (do) / reach the point of",
        explanation: "Marks a gradual change in ability or habit over time.",
        example: {
          kanjiKana: "漢字が読めるようになりました。",
          segments: ["かんじ", "が", "よめるように", "なりました。"],
          english: "I've become able to read kanji.",
        },
      },
      {
        pattern: "〜そうです",
        meaning: "looks like ~ / seems ~ (appearance)",
        explanation:
          "Attached to an adjective or verb stem to describe how something appears from observation.",
        example: {
          kanjiKana: "このケーキはおいしそうです。",
          segments: ["この", "けーき", "は", "おいしそうです。"],
          english: "This cake looks delicious.",
        },
      },
      {
        pattern: "〜すぎる",
        meaning: "too much ~",
        explanation:
          "Attach すぎる to a verb or adjective stem to say something is excessive.",
        example: {
          kanjiKana: "昨日は食べすぎました。",
          segments: ["きのう", "は", "たべすぎました。"],
          english: "I ate too much yesterday.",
        },
      },
      {
        pattern: "〜なければならない",
        meaning: "must do ~",
        explanation:
          "Expresses obligation: the negative conditional なければ plus ならない.",
        example: {
          kanjiKana: "宿題をしなければなりません。",
          segments: ["しゅくだい", "を", "しなければ", "なりません。"],
          english: "I have to do my homework.",
        },
      },
      {
        pattern: "〜てもいいですか",
        meaning: "may I ~?",
        explanation:
          "Asks for permission using the て-form plus もいいですか。",
        example: {
          kanjiKana: "ここに座ってもいいですか。",
          segments: ["ここに", "すわっても", "いいですか。"],
          english: "May I sit here?",
        },
      },
      {
        pattern: "〜たことがあります",
        meaning: "have done ~ before",
        explanation:
          "Describes past experience using the plain past た-form plus ことがあります。",
        example: {
          kanjiKana: "京都に行ったことがあります。",
          segments: ["きょうと", "に", "いった", "ことが", "あります。"],
          english: "I have been to Kyoto before.",
        },
      },
    ],
    n3: [
      {
        pattern: "〜ばよかった",
        meaning: "should have done ~",
        explanation:
          "Expresses regret about a past action using the conditional ば plus よかった。",
        example: {
          kanjiKana: "もっと勉強すればよかったです。",
          segments: ["もっと", "べんきょうすれば", "よかったです。"],
          english: "I should have studied more.",
        },
      },
      {
        pattern: "〜わけではない",
        meaning: "doesn't necessarily mean that ~",
        explanation:
          "Softens a conclusion by denying a full generalization rather than one specific fact.",
        example: {
          kanjiKana: "嫌いなわけではありません。",
          segments: ["きらいな", "わけでは", "ありません。"],
          english: "It's not that I dislike it.",
        },
      },
      {
        pattern: "〜ように",
        meaning: "so that ~ / in order to ~",
        explanation:
          "Expresses purpose or a hoped-for result, often with potential or state verbs.",
        example: {
          kanjiKana: "忘れないようにメモします。",
          segments: ["わすれないように", "めも", "します。"],
          english: "I'll take notes so I don't forget.",
        },
      },
      {
        pattern: "〜つつある",
        meaning: "in the process of ~ing",
        explanation:
          "A literary way to describe a change that is currently in progress.",
        example: {
          kanjiKana: "環境は変わりつつあります。",
          segments: ["かんきょう", "は", "かわりつつ", "あります。"],
          english: "The environment is in the process of changing.",
        },
      },
      {
        pattern: "〜さえ〜ば",
        meaning: "if only ~ / as long as ~",
        explanation:
          "Highlights the one condition that is sufficient for the result to hold.",
        example: {
          kanjiKana: "時間さえあれば行きます。",
          segments: ["じかん", "さえ", "あれば", "いきます。"],
          english: "As long as I have time, I'll go.",
        },
      },
      {
        pattern: "〜おかげで",
        meaning: "thanks to ~",
        explanation:
          "Attributes a good result to a cause, person, or circumstance.",
        example: {
          kanjiKana: "先生のおかげで合格しました。",
          segments: ["せんせい", "の", "おかげで", "ごうかくしました。"],
          english: "Thanks to my teacher, I passed.",
        },
      },
    ],
  };

  /** Derive each grammar example's continuous `hiragana` string from its
   *  segments, same as the sentence bank above. */
  const GRAMMAR_POINTS = Object.fromEntries(
    Object.entries(GRAMMAR_POINTS_RAW).map(([level, points]) => [
      level,
      points.map((p) => ({
        ...p,
        example: { ...p.example, hiragana: p.example.segments.join("") },
      })),
    ]),
  );

  /* ========================================================================
     2c. DOKKAI (READING COMPREHENSION) MINI-STORIES  (NEW)
     One short hardcoded story per level. Each sentence is authored as a
     chunk list rather than a plain string: a chunk with a `reading` renders
     as <ruby>text<rt>reading</rt></ruby> (word-level furigana — the same
     convention used in real graded readers), a chunk without one renders as
     plain text (kana, particles, punctuation, katakana loanwords). The N3
     story deliberately reuses several of the exact grammar patterns from
     the Grammar tab (わけではない / つつある / さえ〜ば / おかげで / ばよかった)
     so Reading Practice reinforces what the learner studied there.
     ======================================================================== */

  const DOKKAI_STORIES = {
    n5: {
      title: "わたしの一日 (My Day)",
      sentences: [
        {
          chunks: [
            { text: "私", reading: "わたし" },
            { text: "は" },
            { text: "毎朝", reading: "まいあさ" },
            { text: "七時", reading: "しちじ" },
            { text: "に" },
            { text: "起", reading: "お" },
            { text: "きます。" },
          ],
          english: "I get up at seven every morning.",
        },
        {
          chunks: [
            { text: "それから、" },
            { text: "朝", reading: "あさ" },
            { text: "ご飯", reading: "ごはん" },
            { text: "を" },
            { text: "食", reading: "た" },
            { text: "べます。" },
          ],
          english: "After that, I eat breakfast.",
        },
        {
          chunks: [
            { text: "八時", reading: "はちじ" },
            { text: "に" },
            { text: "学校", reading: "がっこう" },
            { text: "へ" },
            { text: "行", reading: "い" },
            { text: "きます。" },
          ],
          english: "I go to school at eight.",
        },
        {
          chunks: [
            { text: "学校", reading: "がっこう" },
            { text: "で" },
            { text: "友達", reading: "ともだち" },
            { text: "と" },
            { text: "日本語", reading: "にほんご" },
            { text: "を" },
            { text: "勉強", reading: "べんきょう" },
            { text: "します。" },
          ],
          english: "I study Japanese with friends at school.",
        },
        {
          chunks: [
            { text: "夜", reading: "よる" },
            { text: "、" },
            { text: "家", reading: "いえ" },
            { text: "で" },
            { text: "テレビ" },
            { text: "を" },
            { text: "見", reading: "み" },
            { text: "ます。" },
          ],
          english: "At night, I watch TV at home.",
        },
        {
          chunks: [
            { text: "今日", reading: "きょう" },
            { text: "はいい" },
            { text: "一日", reading: "いちにち" },
            { text: "でした。" },
          ],
          english: "Today was a good day.",
        },
      ],
    },
    n4: {
      title: "日本旅行 (My Trip to Japan)",
      sentences: [
        {
          chunks: [
            { text: "去年", reading: "きょねん" },
            { text: "、" },
            { text: "初", reading: "はじ" },
            { text: "めて" },
            { text: "日本", reading: "にほん" },
            { text: "へ" },
            { text: "旅行", reading: "りょこう" },
            { text: "しました。" },
          ],
          english: "Last year, I traveled to Japan for the first time.",
        },
        {
          chunks: [
            { text: "京都", reading: "きょうと" },
            { text: "の" },
            { text: "お" },
            { text: "寺", reading: "てら" },
            { text: "はとても" },
            { text: "静", reading: "しず" },
            { text: "かで" },
            { text: "美", reading: "うつく" },
            { text: "しかったです。" },
          ],
          english: "Kyoto's temples were very quiet and beautiful.",
        },
        {
          chunks: [
            { text: "日本語", reading: "にほんご" },
            { text: "で" },
            { text: "注文", reading: "ちゅうもん" },
            { text: "するのは" },
            { text: "難", reading: "むずか" },
            { text: "しそうでしたが、" },
            { text: "頑張", reading: "がんば" },
            { text: "りました。" },
          ],
          english: "Ordering in Japanese seemed difficult, but I did my best.",
        },
        {
          chunks: [
            { text: "少", reading: "すこ" },
            { text: "しずつ、" },
            { text: "簡単", reading: "かんたん" },
            { text: "な" },
            { text: "会話", reading: "かいわ" },
            { text: "ができるようになりました。" },
          ],
          english:
            "Little by little, I became able to have simple conversations.",
        },
        {
          chunks: [
            { text: "また" },
            { text: "日本", reading: "にほん" },
            { text: "へ" },
            { text: "行", reading: "い" },
            { text: "ったことがある" },
            { text: "友達", reading: "ともだち" },
            { text: "に" },
            { text: "色々", reading: "いろいろ" },
            { text: "な" },
            { text: "話", reading: "はなし" },
            { text: "を" },
            { text: "聞", reading: "き" },
            { text: "きました。" },
          ],
          english:
            "I also heard various stories from a friend who has been to Japan before.",
        },
        {
          chunks: [
            { text: "来年", reading: "らいねん" },
            { text: "、もう" },
            { text: "一度", reading: "いちど" },
            { text: "行", reading: "い" },
            { text: "きたいと" },
            { text: "思", reading: "おも" },
            { text: "っています。" },
          ],
          english: "Next year, I'm thinking of going once more.",
        },
      ],
    },
    n3: {
      title: "転職の決断 (The Decision to Change Jobs)",
      sentences: [
        {
          chunks: [
            { text: "田中", reading: "たなか" },
            { text: "さんは" },
            { text: "十年間", reading: "じゅうねんかん" },
            { text: "、" },
            { text: "同", reading: "おな" },
            { text: "じ" },
            { text: "会社", reading: "かいしゃ" },
            { text: "で" },
            { text: "働", reading: "はたら" },
            { text: "いてきました。" },
          ],
          english: "Mr. Tanaka has worked at the same company for ten years.",
        },
        {
          chunks: [
            { text: "仕事", reading: "しごと" },
            { text: "に" },
            { text: "不満", reading: "ふまん" },
            { text: "があったわけではありませんが、" },
            { text: "新", reading: "あたら" },
            { text: "しい" },
            { text: "挑戦", reading: "ちょうせん" },
            { text: "をしたいと" },
            { text: "感", reading: "かん" },
            { text: "じていました。" },
          ],
          english:
            "It's not that he was dissatisfied with his job, but he felt he wanted a new challenge.",
        },
        {
          chunks: [
            { text: "社会", reading: "しゃかい" },
            { text: "は" },
            { text: "急速", reading: "きゅうそく" },
            { text: "に" },
            { text: "変", reading: "か" },
            { text: "わりつつあり、" },
            { text: "彼", reading: "かれ" },
            { text: "は" },
            { text: "自分", reading: "じぶん" },
            { text: "の" },
            { text: "将来", reading: "しょうらい" },
            { text: "について" },
            { text: "真剣", reading: "しんけん" },
            { text: "に" },
            { text: "考", reading: "かんが" },
            { text: "えました。" },
          ],
          english:
            "Society is rapidly changing, and he seriously thought about his own future.",
        },
        {
          chunks: [
            { text: "家族", reading: "かぞく" },
            { text: "の" },
            { text: "理解", reading: "りかい" },
            { text: "さえあれば、" },
            { text: "転職", reading: "てんしょく" },
            { text: "しても" },
            { text: "大丈夫", reading: "だいじょうぶ" },
            { text: "だと" },
            { text: "思", reading: "おも" },
            { text: "いました。" },
          ],
          english:
            "He thought that as long as he had his family's understanding, it would be okay to change jobs.",
        },
        {
          chunks: [
            { text: "妻", reading: "つま" },
            { text: "のおかげで、" },
            { text: "勇気", reading: "ゆうき" },
            { text: "を" },
            { text: "持", reading: "も" },
            { text: "って" },
            { text: "新", reading: "あたら" },
            { text: "しい" },
            { text: "会社", reading: "かいしゃ" },
            { text: "に" },
            { text: "応募", reading: "おうぼ" },
            { text: "することができました。" },
          ],
          english:
            "Thanks to his wife, he was able to muster the courage to apply to a new company.",
        },
        {
          chunks: [
            { text: "今", reading: "いま" },
            { text: "では、もっと" },
            { text: "早", reading: "はや" },
            { text: "く" },
            { text: "決断", reading: "けつだん" },
            { text: "すればよかったと" },
            { text: "思", reading: "おも" },
            { text: "っています。" },
          ],
          english: "Now, he thinks he should have made the decision sooner.",
        },
      ],
    },
  };

  /* ========================================================================
     3. GLOBAL STATE + LOCALSTORAGE STATUS/DATA SYSTEM
     Every trackable item (kanji, vocab word, grammar point) gets a stable
     id like "kanji:食" / "vocab:食べる" / "grammar:〜たいです". Its 3-state
     status lives at localStorage["jlpt_status_{id}"], and a JSON snapshot
     of the fields needed to render it later (for flashcards/quiz, without
     re-fetching) lives at localStorage["jlpt_data_{id}"].
     ======================================================================== */

  const STATUS_PREFIX = "jlpt_status_";
  const DATA_PREFIX = "jlpt_data_";
  const STATUS_ORDER = ["unlearned", "learning", "mastered"];
  const STATUS_ICON = { unlearned: "⚪", learning: "🟡", mastered: "🟢" };
  const STATUS_LABEL = {
    unlearned: "Unlearned",
    learning: "Learning",
    mastered: "Mastered",
  };

  // ---- SRS (Leitner-style) scheduling constants — see section 6 for the
  // grading logic that reads/writes these. Kept here alongside the status
  // system since setStatus() below needs to seed them the moment an item
  // first becomes "Learning". ----
  const SRS_INITIAL_INTERVAL_MIN = 10; // first interval a new Learning item gets
  const SRS_AGAIN_INTERVAL_MIN = 1; // [Again] always resets to this
  const SRS_HARD_MULTIPLIER = 1.2;
  const SRS_GOOD_MULTIPLIER = 2.5;
  const SRS_EASY_MULTIPLIER = 4;
  const SRS_GRADUATION_INTERVAL_MIN = 60 * 24 * 7; // 7 days: interval this long auto-graduates to Mastered

  const state = {
    level: "n5",
    mode: "explorer",
    explorerTab: "kanji",
    query: "",
    theme: "ink",
    statusFilter: "all",
    kanjiListsByLevel: {}, // level -> array of characters (cached once per level)
    kanjiOffset: 0,
    kanjiBatchSize: 24,
    kanjiCache: new Map(), // character -> full detail object from kanjiapi.dev
    focusedKanjiSearch: false,
    vocabResults: [],
    flashcardQueue: [],
    flashcardTotal: 0,
    quizSession: null,
  };

  function getStatus(id) {
    return localStorage.getItem(STATUS_PREFIX + id) || "unlearned";
  }

  /** Core status write with no UI refresh — used directly by bulk
   *  operations (like Add All to Deck) so a loop over 300+ kanji doesn't
   *  trigger 300+ redundant progress/badge recalculations. setStatus()
   *  below wraps this for the normal single-click path. */
  function applyStatusChange(id, status) {
    const prev = getStatus(id);
    localStorage.setItem(STATUS_PREFIX + id, status);

    // The moment an item first becomes "Learning" (whether by clicking the
    // status badge directly, or via a flashcard grade), it needs a starting
    // point on the review clock. Only seed it if it doesn't already have a
    // schedule, so demoting a Mastered item back to Learning via [Again]
    // doesn't clobber the interval [Again] is about to set explicitly.
    if (status === "learning" && prev !== "learning") {
      const data = readItemData(id) || {};
      if (!data.interval) {
        data.interval = SRS_INITIAL_INTERVAL_MIN;
        data.nextReviewDate = Date.now();
        writeItemData(id, data);
      }
    }
  }

  function setStatus(id, status) {
    applyStatusChange(id, status);
    refreshProgressUI();
    refreshAllStatusToggles();
    applyStatusFilter();
    refreshFlashcardDueBadge();
  }

  function cycleStatus(current) {
    const i = STATUS_ORDER.indexOf(current);
    return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
  }

  function statusToggleInner(status) {
    return `${STATUS_ICON[status]} ${STATUS_LABEL[status]}`;
  }

  /** Snapshot everything a flashcard/quiz question would need for this item.
   *  Called every time a card is rendered so the cache always reflects the
   *  latest fetched detail, independent of the item's learning status. */
  function writeItemData(id, dataObj) {
    localStorage.setItem(DATA_PREFIX + id, JSON.stringify(dataObj));
  }

  function readItemData(id) {
    try {
      const raw = localStorage.getItem(DATA_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** Scan localStorage for every tracked item whose status is in
   *  `statuses`, optionally restricted to one JLPT level. Used to build
   *  the flashcard queue and the quiz question pool. */
  function getAllTrackedItems(statuses, levelFilter = null) {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STATUS_PREFIX)) continue;
      const id = key.slice(STATUS_PREFIX.length);
      const status = localStorage.getItem(key);
      if (!statuses.includes(status)) continue;
      const data = readItemData(id);
      if (!data) continue;
      if (levelFilter && data.level !== levelFilter) continue;
      out.push({ id, status, ...data });
    }
    return out;
  }

  // ---- SRS scheduling read/write ----

  /** Read this item's current { interval (minutes), nextReviewDate (epoch
   *  ms) }, falling back to sane defaults for items that predate the SRS
   *  feature or have never been scheduled yet. */
  function getSchedule(id) {
    const data = readItemData(id) || {};
    return {
      interval:
        typeof data.interval === "number"
          ? data.interval
          : SRS_INITIAL_INTERVAL_MIN,
      nextReviewDate:
        typeof data.nextReviewDate === "number"
          ? data.nextReviewDate
          : Date.now(),
    };
  }

  function updateSchedule(id, interval, nextReviewDate) {
    const data = readItemData(id) || {};
    data.interval = interval;
    data.nextReviewDate = nextReviewDate;
    writeItemData(id, data);
  }

  /** An item with no schedule yet (nextReviewDate undefined — pre-SRS saves,
   *  or a Mastered item that was never routed through Learning) is always
   *  considered due; otherwise it's due once its nextReviewDate has passed. */
  function isDue(item) {
    return (
      typeof item.nextReviewDate !== "number" ||
      item.nextReviewDate <= Date.now()
    );
  }

  function countDueReviews(level) {
    return getAllTrackedItems(["learning", "mastered"], level).filter(isDue)
      .length;
  }

  function formatInterval(minutes) {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    if (minutes < 60 * 24) return `${(minutes / 60).toFixed(1)}h`;
    return `${(minutes / (60 * 24)).toFixed(1)}d`;
  }

  /** Progress % = (Mastered Items / Total Level Items) * 100, scoped to
   *  Kanji + Grammar (both have a fixed, known total per level — Vocabulary
   *  is search-driven and open-ended, so it is tracked but not counted
   *  toward the denominator). */
  function computeProgress(level) {
    const kanjiTotal = (state.kanjiListsByLevel[level] || []).length;
    const grammarTotal = (GRAMMAR_POINTS[level] || []).length;
    const total = kanjiTotal + grammarTotal;
    const tracked = getAllTrackedItems(["learning", "mastered"], level).filter(
      (it) => it.type === "kanji" || it.type === "grammar",
    );
    const mastered = tracked.filter((t) => t.status === "mastered").length;
    const learning = tracked.filter((t) => t.status === "learning").length;
    const unlearned = Math.max(total - mastered - learning, 0);
    const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { total, mastered, learning, unlearned, percent };
  }

  /* ========================================================================
     4. API LAYER  (unchanged endpoints, integrated with the level-list cache)
     ======================================================================== */

  const KANJI_API = "https://kanjiapi.dev/v1/kanji";
  const CORS_PROXY = "https://corsproxy.io/?url=";
  const JISHO_API = "https://jisho.org/api/v1/search/words?keyword=";

  async function fetchLevelKanjiList(level) {
    const n = level.replace("n", "");
    const res = await fetch(`${KANJI_API}/jlpt-${n}`);
    if (!res.ok)
      throw new Error(`kanjiapi list request failed (${res.status})`);
    return res.json();
  }

  /** Ensure the character list for a level is cached in state before we
   *  need it (Explorer grid AND the progress dashboard both rely on it). */
  async function ensureKanjiList(level) {
    if (state.kanjiListsByLevel[level]) return state.kanjiListsByLevel[level];
    const list = await fetchLevelKanjiList(level);
    state.kanjiListsByLevel[level] = list;
    return list;
  }

  async function fetchKanjiDetail(char) {
    if (state.kanjiCache.has(char)) return state.kanjiCache.get(char);
    const res = await fetch(`${KANJI_API}/${encodeURIComponent(char)}`);
    if (!res.ok)
      throw new Error(`kanjiapi detail request failed (${res.status})`);
    const data = await res.json();
    state.kanjiCache.set(char, data);
    return data;
  }

  async function searchJisho(keyword) {
    const target = JISHO_API + encodeURIComponent(keyword);
    const res = await fetch(CORS_PROXY + encodeURIComponent(target));
    if (!res.ok) throw new Error(`Jisho proxy request failed (${res.status})`);
    const data = await res.json();
    return data.data || [];
  }

  /* ========================================================================
     5. RENDERING HELPERS
     ======================================================================== */

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      toast("Speech synthesis isn't supported in this browser");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find((v) => v.lang && v.lang.startsWith("ja"));
    if (jaVoice) utter.voice = jaVoice;
    utter.rate = 0.92;
    window.speechSynthesis.speak(utter);
  }

  // ---- Sentence engine (5-line block) — unchanged ----

  function buildSentenceLinesHTML(sentence) {
    const katakana = hiraganaToKatakana(sentence.hiragana);
    // Word-spaced romaji when segment data is available (sentence bank and
    // grammar examples); falls back to the old unsegmented conversion for
    // any ad-hoc single-reading text passed through this same renderer.
    const romaji = sentence.segments
      ? toRomajiSentence(sentence.segments)
      : toRomaji(sentence.hiragana);
    const lines = [
      ["Kanji+Kana", sentence.kanjiKana, "kanjikana"],
      ["Furigana", sentence.hiragana, "furigana"],
      ["Katakana", katakana, "katakana"],
      ["Romaji", romaji, "romaji"],
      ["English", sentence.english, "english"],
    ];
    return lines
      .map(
        ([label, text, cls]) => `
      <div class="sentence-line ${cls}">
        <span class="line-tag">${label}</span>
        <span class="line-text">${escapeHtml(text)}</span>
      </div>
    `,
      )
      .join("");
  }

  function buildSentenceCardHTML(sentence) {
    const kanjiTags = extractKanjiChars(sentence.kanjiKana)
      .map((k) => `<span class="keyword-chip">${k}</span>`)
      .join("");
    return `
      <article class="sentence-card">
        <div class="sentence-lines">${buildSentenceLinesHTML(sentence)}</div>
        <div class="sentence-footer">
          <div class="sentence-keywords">${kanjiTags}</div>
          <button class="speak-btn" data-speak="${escapeHtml(sentence.kanjiKana)}" title="Listen" aria-label="Listen">🔊</button>
        </div>
      </article>
    `;
  }

  function renderSentenceBank(filterQuery = "") {
    const list = document.getElementById("sentenceList");
    const q = filterQuery.trim();
    const filtered = q
      ? SENTENCES.filter(
          (s) =>
            s.kanjiKana.includes(q) ||
            s.hiragana.includes(q) ||
            s.english.toLowerCase().includes(q.toLowerCase()),
        )
      : SENTENCES;

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-state"><p>見つかりません — No sentences match “${escapeHtml(q)}”.</p></div>`;
      return;
    }
    list.innerHTML = filtered.map(buildSentenceCardHTML).join("");
  }

  // ---- Reading Practice / Dokkai (NEW) ----

  /** Render one sentence's chunk list as ruby-annotated HTML: a chunk with
   *  a `reading` becomes <ruby>text<rt>reading</rt></ruby> (furigana), a
   *  chunk without one is plain escaped text (kana, particles, katakana). */
  function buildFuriganaSentenceHTML(chunks) {
    return chunks
      .map((c) =>
        c.reading
          ? `<ruby>${escapeHtml(c.text)}<rt>${escapeHtml(c.reading)}</rt></ruby>`
          : escapeHtml(c.text),
      )
      .join("");
  }

  function renderReadingStory() {
    const container = document.getElementById("readingStory");
    const story = DOKKAI_STORIES[state.level];
    document.getElementById("readingLevelName").textContent =
      state.level.toUpperCase();

    if (!story) {
      container.innerHTML = `<div class="empty-state"><p>No reading passage for this level yet.</p></div>`;
      return;
    }

    const furiganaHidden = !document.getElementById("furiganaToggle").checked;
    container.classList.toggle("furigana-hidden", furiganaHidden);

    const rows = story.sentences
      .map(
        (sentence, i) => `
      <div class="dokkai-sentence-row">
        <span class="dokkai-sentence" data-sentence-index="${i}" tabindex="0" role="button" aria-label="Translate sentence ${i + 1}">${buildFuriganaSentenceHTML(sentence.chunks)}</span>
        <p class="sentence-translation" data-sentence-index="${i}">${escapeHtml(sentence.english)}</p>
      </div>
    `,
      )
      .join("");

    container.innerHTML = `<h3 class="reading-story-title">${escapeHtml(story.title)}</h3>${rows}`;
  }

  /** Tap-to-translate: flip the clicked sentence's highlight and slide its
   *  matching translation open/closed. Each sentence toggles independently
   *  so the learner can compare several at once if they want to. */
  function toggleDokkaiTranslation(sentenceEl) {
    const index = sentenceEl.getAttribute("data-sentence-index");
    const translationEl = document.querySelector(
      `.sentence-translation[data-sentence-index="${index}"]`,
    );
    if (!translationEl) return;
    sentenceEl.classList.toggle("active");
    translationEl.classList.toggle("open");
  }

  // ---- Grammar cards (NEW) ----

  function grammarItemId(pattern) {
    return `grammar:${pattern}`;
  }

  function grammarCardHTML(point) {
    const id = grammarItemId(point.pattern);
    writeItemData(id, {
      type: "grammar",
      level: state.level,
      display: point.pattern,
      pattern: point.pattern,
      meaning: point.meaning,
      explanation: point.explanation,
      example: point.example,
    });
    const status = getStatus(id);
    return `
      <article class="grammar-card" data-item-id="${id}">
        <div class="card-top-row">
          <span class="grammar-pattern">${escapeHtml(point.pattern)}</span>
          <span class="jlpt-tag">${state.level.toUpperCase()}</span>
        </div>
        <div class="grammar-meaning">${escapeHtml(point.meaning)}</div>
        <div class="grammar-explanation">${escapeHtml(point.explanation)}</div>
        <div class="sentence-lines">${buildSentenceLinesHTML(point.example)}</div>
        <div class="card-actions">
          <button class="status-toggle" data-status-toggle-id="${id}" data-status="${status}">${statusToggleInner(status)}</button>
          <button class="speak-btn" data-speak="${escapeHtml(point.example.kanjiKana)}" title="Listen" aria-label="Listen">🔊</button>
        </div>
      </article>
    `;
  }

  function renderGrammarGrid() {
    const grid = document.getElementById("grammarGrid");
    const points = GRAMMAR_POINTS[state.level] || [];
    grid.innerHTML = points.map(grammarCardHTML).join("");
    applyStatusFilter();
  }

  // ---- Kanji cards + grid ----

  function jlptTagText(jlptNumber) {
    return jlptNumber ? `N${jlptNumber}` : "—";
  }

  function kanjiItemId(char) {
    return `kanji:${char}`;
  }

  function kanjiCardHTML(detail) {
    const id = kanjiItemId(detail.kanji);
    const level = detail.jlpt ? `n${detail.jlpt}` : state.level;
    writeItemData(id, {
      type: "kanji",
      level,
      char: detail.kanji,
      display: detail.kanji,
      meanings: detail.meanings || [],
      onyomi: detail.on_readings || [],
      kunyomi: detail.kun_readings || [],
      strokeCount: detail.stroke_count,
    });
    const status = getStatus(id);
    const meanings = (detail.meanings || []).slice(0, 3).join(", ") || "—";
    return `
      <article class="kanji-card" data-char="${detail.kanji}" data-item-id="${id}" tabindex="0" role="button" aria-label="Open ${detail.kanji}">
        <div class="card-top-row">
          <span class="kanji-glyph">${detail.kanji}</span>
          <span class="jlpt-tag">${jlptTagText(detail.jlpt)}</span>
        </div>
        <div class="card-meanings">${escapeHtml(meanings)}</div>
        <div class="stroke-count">${detail.stroke_count ?? "?"} strokes</div>
        <div class="card-actions">
          <button class="status-toggle" data-status-toggle-id="${id}" data-status="${status}">${statusToggleInner(status)}</button>
          <button class="speak-btn" data-speak="${detail.kanji}" title="Listen" aria-label="Listen">🔊</button>
        </div>
      </article>
    `;
  }

  function kanjiSkeletonHTML(count) {
    return Array.from(
      { length: count },
      () => `<div class="card-skeleton"></div>`,
    ).join("");
  }

  async function loadKanjiLevelList() {
    const grid = document.getElementById("kanjiGrid");
    state.focusedKanjiSearch = false;
    state.kanjiOffset = 0;
    grid.innerHTML = kanjiSkeletonHTML(state.kanjiBatchSize);
    setSearchStatus("loading level…", "busy");
    try {
      await ensureKanjiList(state.level);
      grid.innerHTML = "";
      setSearchStatus("");
      await renderNextKanjiBatch();
      refreshProgressUI();
    } catch (err) {
      grid.innerHTML = `<div class="empty-state"><p>Couldn't reach kanjiapi.dev. Check your connection and try again. (${escapeHtml(err.message)})</p></div>`;
      setSearchStatus("error", "err");
    }
  }

  async function renderNextKanjiBatch() {
    const grid = document.getElementById("kanjiGrid");
    const loadMoreWrap = document.getElementById("kanjiLoadMoreWrap");
    const chars = state.kanjiListsByLevel[state.level] || [];
    const batch = chars.slice(
      state.kanjiOffset,
      state.kanjiOffset + state.kanjiBatchSize,
    );
    if (batch.length === 0) {
      loadMoreWrap.classList.add("hidden");
      return;
    }
    const skeletons = document.createElement("div");
    skeletons.innerHTML = kanjiSkeletonHTML(batch.length);
    const skeletonNodes = [...skeletons.children];
    skeletonNodes.forEach((n) => grid.appendChild(n));

    const details = await Promise.allSettled(batch.map(fetchKanjiDetail));

    skeletonNodes.forEach((n) => n.remove());
    details.forEach((r) => {
      if (r.status === "fulfilled")
        grid.insertAdjacentHTML("beforeend", kanjiCardHTML(r.value));
    });

    state.kanjiOffset += batch.length;
    loadMoreWrap.classList.toggle("hidden", state.kanjiOffset >= chars.length);
    applyStatusFilter();
  }

  async function handleKanjiSearch(query) {
    const grid = document.getElementById("kanjiGrid");
    const loadMoreWrap = document.getElementById("kanjiLoadMoreWrap");
    const trimmed = query.trim();

    if (!trimmed) {
      loadKanjiLevelList();
      return;
    }

    const kanjiChars = extractKanjiChars(trimmed);
    if (kanjiChars.length >= 1) {
      state.focusedKanjiSearch = true;
      loadMoreWrap.classList.add("hidden");
      grid.innerHTML = kanjiSkeletonHTML(1);
      setSearchStatus("looking up…", "busy");
      try {
        const detail = await fetchKanjiDetail(kanjiChars[0]);
        grid.innerHTML = kanjiCardHTML(detail);
        applyStatusFilter();
        setSearchStatus("1 result");
      } catch {
        grid.innerHTML = `<div class="empty-state"><p>No data found for “${escapeHtml(kanjiChars[0])}”.</p></div>`;
        setSearchStatus("no result");
      }
      return;
    }

    const cached = [...state.kanjiCache.values()];
    const matches = cached.filter((d) =>
      (d.meanings || []).some((m) =>
        m.toLowerCase().includes(trimmed.toLowerCase()),
      ),
    );
    loadMoreWrap.classList.add("hidden");
    if (matches.length === 0) {
      grid.innerHTML = `<div class="empty-state"><p>No loaded kanji match “${escapeHtml(trimmed)}” yet — try "Load more kanji" first, or search a specific character.</p></div>`;
    } else {
      grid.innerHTML = matches.map(kanjiCardHTML).join("");
      applyStatusFilter();
    }
    setSearchStatus(
      `${matches.length} result${matches.length === 1 ? "" : "s"}`,
    );
  }

  // ---- Vocabulary cards + grid ----

  function vocabDisplayFields(entry) {
    const jp = (entry.japanese && entry.japanese[0]) || {};
    const word = jp.word || jp.reading || "?";
    const reading = jp.word ? jp.reading : "";
    const meanings = (entry.senses || []).flatMap(
      (s) => s.english_definitions || [],
    );
    const jlptRaw = (entry.jlpt && entry.jlpt[0]) || null;
    const jlptTag = jlptRaw ? jlptRaw.replace("jlpt-", "") : null; // e.g. "n5"
    return { word, reading, meanings, jlptTag };
  }

  function vocabItemId(word) {
    return `vocab:${word}`;
  }

  function vocabCardHTML(entry) {
    const { word, reading, meanings, jlptTag } = vocabDisplayFields(entry);
    const id = vocabItemId(word);
    const level = jlptTag || state.level;
    writeItemData(id, {
      type: "vocab",
      level,
      word,
      display: word,
      reading,
      meanings,
    });
    const status = getStatus(id);
    const meaningsPreview = meanings.slice(0, 4).join(", ") || "—";
    return `
      <article class="vocab-card" data-word="${escapeHtml(word)}" data-reading="${escapeHtml(reading)}" data-item-id="${id}" tabindex="0" role="button" aria-label="Open ${escapeHtml(word)}">
        <div class="card-top-row">
          <div>
            <span class="vocab-word">${escapeHtml(word)}</span>
            ${reading ? `<span class="vocab-reading">${escapeHtml(reading)}</span>` : ""}
          </div>
          ${jlptTag ? `<span class="jlpt-tag">${jlptTag.toUpperCase()}</span>` : ""}
        </div>
        <div class="card-meanings">${escapeHtml(meaningsPreview)}</div>
        <div class="card-actions">
          <button class="status-toggle" data-status-toggle-id="${id}" data-status="${status}">${statusToggleInner(status)}</button>
          <button class="speak-btn" data-speak="${escapeHtml(reading || word)}" title="Listen" aria-label="Listen">🔊</button>
        </div>
      </article>
    `;
  }

  async function searchVocab(query) {
    const grid = document.getElementById("vocabGrid");
    const emptyState = document.getElementById("vocabEmpty");
    const trimmed = query.trim();
    if (!trimmed) {
      grid.innerHTML = "";
      emptyState.classList.remove("hidden");
      loadStarterVocab();
      return;
    }
    emptyState.classList.add("hidden");
    grid.innerHTML = kanjiSkeletonHTML(6);
    setSearchStatus("searching Jisho…", "busy");
    try {
      const results = await searchJisho(trimmed);
      state.vocabResults = results;
      if (results.length === 0) {
        grid.innerHTML = `<div class="empty-state"><p>No results for “${escapeHtml(trimmed)}”.</p></div>`;
      } else {
        grid.innerHTML = results.slice(0, 24).map(vocabCardHTML).join("");
        applyStatusFilter();
      }
      setSearchStatus(
        `${results.length} result${results.length === 1 ? "" : "s"}`,
      );
    } catch (err) {
      grid.innerHTML = `<div class="empty-state"><p>Couldn't reach the Jisho proxy right now. (${escapeHtml(err.message)}) — try again in a moment.</p></div>`;
      setSearchStatus("error", "err");
    }
  }

  let starterVocabLoaded = false;
  async function loadStarterVocab() {
    if (starterVocabLoaded) return;
    starterVocabLoaded = true;
    const starters = ["食べる", "学校", "友達", "大丈夫"];
    const grid = document.getElementById("vocabGrid");
    try {
      const batches = await Promise.all(starters.map(searchJisho));
      const firstOfEach = batches.map((b) => b[0]).filter(Boolean);
      if (firstOfEach.length) {
        document.getElementById("vocabEmpty").classList.add("hidden");
        grid.innerHTML = firstOfEach.map(vocabCardHTML).join("");
        applyStatusFilter();
      }
    } catch {
      starterVocabLoaded = false;
    }
  }

  // ---- Grid View (rapid whole-level review, NEW) ----

  /** Compact mini-card. Without a detail object yet (still streaming in),
   *  render a glyph-only loading tile so the grid appears instantly and
   *  fills in progressively rather than blocking on every kanji at once. */
  function miniKanjiCardHTML(char, detail) {
    if (!detail) {
      return `<div class="mini-kanji-card is-loading" data-char="${char}">
        <span class="mini-kanji-glyph">${char}</span>
        <span class="mini-kanji-meaning">…</span>
      </div>`;
    }
    const id = kanjiItemId(detail.kanji);
    const level = detail.jlpt ? `n${detail.jlpt}` : state.level;
    writeItemData(id, {
      type: "kanji",
      level,
      char: detail.kanji,
      display: detail.kanji,
      meanings: detail.meanings || [],
      onyomi: detail.on_readings || [],
      kunyomi: detail.kun_readings || [],
      strokeCount: detail.stroke_count,
    });
    const status = getStatus(id);
    const meaning = (detail.meanings && detail.meanings[0]) || "—";
    const onyomi = (detail.on_readings || []).join("・") || "—";
    const kunyomi = (detail.kun_readings || []).join("・") || "—";
    return `
      <div class="mini-kanji-card" data-char="${detail.kanji}" data-item-id="${id}" data-status="${status}" tabindex="0" role="button" aria-label="Open ${detail.kanji}">
        <span class="mini-kanji-glyph">${detail.kanji}</span>
        <span class="mini-kanji-meaning">${escapeHtml(meaning)}</span>
        <span class="mini-kanji-readings"><span class="on">${escapeHtml(onyomi)}</span><br><span class="kun">${escapeHtml(kunyomi)}</span></span>
      </div>
    `;
  }

  /** Render every kanji in the level at once. Characters already in the
   *  shared kanjiCache (e.g. from browsing Explorer first) render fully
   *  populated immediately; anything uncached shows a glyph-only tile that
   *  hydrateGridView() fills in as its detail request resolves. */
  async function renderGridView() {
    const container = document.getElementById("gridViewContainer");
    const targetLevel = state.level;
    document.getElementById("gridViewLevelName").textContent =
      targetLevel.toUpperCase();
    container.innerHTML = kanjiSkeletonHTML(24);

    let chars;
    try {
      chars = await ensureKanjiList(targetLevel);
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><p>Couldn't reach kanjiapi.dev for the character list. (${escapeHtml(err.message)})</p></div>`;
      return;
    }
    if (state.mode !== "gridview" || state.level !== targetLevel) return; // superseded by a later switch

    document.getElementById("gridViewCount").textContent = chars.length;
    container.innerHTML = chars
      .map((c) => miniKanjiCardHTML(c, state.kanjiCache.get(c) || null))
      .join("");
    applyStatusFilter();
    hydrateGridView(chars, targetLevel);
  }

  /** Background-fill any mini-cards still showing the loading state, in
   *  bounded concurrency batches so a large N3 list doesn't fire hundreds
   *  of simultaneous requests. Bails out cleanly if the user has since
   *  switched away from Grid View or changed level. */
  async function hydrateGridView(chars, targetLevel) {
    const CHUNK = 20;
    const missing = chars.filter((c) => !state.kanjiCache.has(c));

    for (let i = 0; i < missing.length; i += CHUNK) {
      if (state.mode !== "gridview" || state.level !== targetLevel) return;
      const chunk = missing.slice(i, i + CHUNK);

      chunk.forEach((char) => {
        fetchKanjiDetail(char)
          .then((detail) => {
            if (state.mode !== "gridview" || state.level !== targetLevel)
              return;
            const container = document.getElementById("gridViewContainer");
            const node =
              container && container.querySelector(`[data-char="${char}"]`);
            if (node) node.outerHTML = miniKanjiCardHTML(char, detail);
            applyStatusFilter();
          })
          .catch(() => {
            const container = document.getElementById("gridViewContainer");
            const node =
              container && container.querySelector(`[data-char="${char}"]`);
            if (node) node.classList.remove("is-loading"); // leave the glyph visible even if detail failed
          });
      });

      await Promise.allSettled(chunk.map(fetchKanjiDetail));
    }
  }

  /** Keep the bulk-add button's label in sync with the selected level —
   *  called on init and every level switch. */
  function updateAddAllButtonLabel() {
    const btn = document.getElementById("addAllToDeckBtn");
    if (btn && !btn.disabled)
      btn.textContent = `Add All ${state.level.toUpperCase()} to Deck`;
  }

  /** Bulk action: move every Unlearned Kanji + Grammar item in the current
   *  level to Learning in one shot. Mastered items are left untouched.
   *  Vocabulary is deliberately excluded — this app has no fixed
   *  "complete word list" per level (vocab comes from live Jisho search,
   *  which is query-driven and open-ended), so there's no finite set to
   *  iterate the way there is for Kanji (kanjiapi's per-level list) and
   *  Grammar (the curated, fixed set on the Grammar tab). */
  async function addAllToDeck() {
    const level = state.level;
    let kanjiChars;
    try {
      kanjiChars = await ensureKanjiList(level);
    } catch {
      toast("Couldn't reach kanjiapi.dev to load the kanji list");
      return;
    }
    const grammarPoints = GRAMMAR_POINTS[level] || [];

    const kanjiIds = kanjiChars.map(kanjiItemId);
    const grammarIds = grammarPoints.map((p) => grammarItemId(p.pattern));
    const allIds = [...kanjiIds, ...grammarIds];
    const eligibleIds = allIds.filter((id) => getStatus(id) === "unlearned");
    const masteredCount = allIds.filter(
      (id) => getStatus(id) === "mastered",
    ).length;

    if (eligibleIds.length === 0) {
      toast(
        `Everything in ${level.toUpperCase()} is already Learning or Mastered`,
      );
      return;
    }

    const confirmed = confirm(
      `Add ${eligibleIds.length} ${level.toUpperCase()} kanji & grammar item${eligibleIds.length === 1 ? "" : "s"} to your Flashcard Review Deck?\n\n` +
        (masteredCount > 0
          ? `${masteredCount} already-Mastered item${masteredCount === 1 ? "" : "s"} will be left untouched.\n\n`
          : "") +
        `Note: Vocabulary isn't included — there's no fixed "complete word list" per level to bulk-add from, since vocab comes from live dictionary search.`,
    );
    if (!confirmed) return;

    const btn = document.getElementById("addAllToDeckBtn");
    btn.disabled = true;

    // Grammar data is fully local already — write + flip status immediately.
    grammarPoints.forEach((point) => {
      const id = grammarItemId(point.pattern);
      writeItemData(id, {
        type: "grammar",
        level,
        display: point.pattern,
        pattern: point.pattern,
        meaning: point.meaning,
        explanation: point.explanation,
        example: point.example,
      });
      if (getStatus(id) === "unlearned") applyStatusChange(id, "learning");
    });

    // Kanji needs its detail fetched so flashcards/quiz have something to
    // show later. Batched (20 at a time) so a large N3 list doesn't fire
    // hundreds of simultaneous requests — anything already cached from a
    // prior Explorer or Grid View visit resolves instantly either way.
    const CHUNK = 20;
    for (let i = 0; i < kanjiChars.length; i += CHUNK) {
      const chunk = kanjiChars.slice(i, i + CHUNK);
      const results = await Promise.allSettled(chunk.map(fetchKanjiDetail));
      results.forEach((r) => {
        if (r.status !== "fulfilled") return;
        const detail = r.value;
        const id = kanjiItemId(detail.kanji);
        const itemLevel = detail.jlpt ? `n${detail.jlpt}` : level;
        writeItemData(id, {
          type: "kanji",
          level: itemLevel,
          char: detail.kanji,
          display: detail.kanji,
          meanings: detail.meanings || [],
          onyomi: detail.on_readings || [],
          kunyomi: detail.kun_readings || [],
          strokeCount: detail.stroke_count,
        });
        if (getStatus(id) === "unlearned") applyStatusChange(id, "learning");
      });
      btn.textContent = `Adding… ${Math.min(i + CHUNK, kanjiChars.length)}/${kanjiChars.length}`;
    }

    btn.disabled = false;
    updateAddAllButtonLabel();

    // One batch of UI refreshes at the end, rather than one per item.
    refreshProgressUI();
    refreshAllStatusToggles();
    applyStatusFilter();
    refreshFlashcardDueBadge();
    if (state.mode === "gridview") renderGridView(); // repaint mini-card status colors
    if (state.mode === "flashcard") {
      buildFlashcardPool();
      renderFlashcardArea();
    }

    toast(
      `Added ${eligibleIds.length} item${eligibleIds.length === 1 ? "" : "s"} to Learning`,
    );
  }

  // ---- Kanji / Vocab Deep-Dive Modal ----

  function readingChipsHTML(readings) {
    if (!readings || readings.length === 0)
      return `<p class="card-meanings">No readings listed.</p>`;
    return `<div class="reading-chips">${readings
      .map(
        (r) => `
        <div class="reading-chip">
          <span class="kana">${escapeHtml(r)}</span>
          <span class="romaji">${escapeHtml(toRomaji(r))}</span>
        </div>
      `,
      )
      .join("")}</div>`;
  }

  async function openKanjiModal(char) {
    const overlay = document.getElementById("kanjiModalOverlay");
    const body = document.getElementById("kanjiModalBody");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    body.innerHTML = `<div class="card-skeleton" style="height:220px"></div>`;

    try {
      const detail = await fetchKanjiDetail(char);
      const id = kanjiItemId(detail.kanji);
      const level = detail.jlpt ? `n${detail.jlpt}` : state.level;
      writeItemData(id, {
        type: "kanji",
        level,
        char: detail.kanji,
        display: detail.kanji,
        meanings: detail.meanings || [],
        onyomi: detail.on_readings || [],
        kunyomi: detail.kun_readings || [],
        strokeCount: detail.stroke_count,
      });
      const status = getStatus(id);
      const sentences = getSentencesFor(detail.kanji);
      const onyomi = detail.on_readings || [];
      const kunyomi = detail.kun_readings || [];

      body.innerHTML = `
        <div class="modal-hero">
          <div id="modalKanjiChar" class="modal-kanji-glyph">${detail.kanji}</div>
          <div class="modal-hero-meta">
            <div class="modal-hero-tags">
              <span class="jlpt-tag">${jlptTagText(detail.jlpt)}</span>
              <span class="stroke-count">${detail.stroke_count ?? "?"} strokes</span>
              ${detail.grade ? `<span class="stroke-count">Grade ${detail.grade}</span>` : ""}
            </div>
            <div class="modal-meanings">${escapeHtml((detail.meanings || []).join(", ") || "No meanings listed")}</div>
            <div class="modal-actions">
              <button class="primary-btn" id="modalSpeak">🔊 Play sound</button>
              <button class="status-toggle" data-status-toggle-id="${id}" data-status="${status}">${statusToggleInner(status)}</button>
            </div>
          </div>
        </div>

        <div class="reading-section">
          <h4>Onyomi 音読み (Katakana / Romaji)</h4>
          ${readingChipsHTML(onyomi)}
        </div>

        <div class="reading-section">
          <h4>Kunyomi 訓読み (Hiragana / Romaji)</h4>
          ${readingChipsHTML(kunyomi)}
        </div>

        ${
          sentences.length
            ? `
          <div class="modal-sentences-wrap">
            <h4>Example sentences using ${detail.kanji}</h4>
            <div class="sentence-list">${sentences.map(buildSentenceCardHTML).join("")}</div>
          </div>`
            : ""
        }
      `;

      body
        .querySelector("#modalSpeak")
        .addEventListener("click", () => speak(detail.kanji));
    } catch (err) {
      body.innerHTML = `<div class="empty-state"><p>Couldn't load data for “${escapeHtml(char)}”. (${escapeHtml(err.message)})</p></div>`;
    }
  }

  async function openVocabModal(word, reading) {
    const overlay = document.getElementById("kanjiModalOverlay");
    const body = document.getElementById("kanjiModalBody");
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");

    const id = vocabItemId(word);
    const readingBase = reading || word;
    const sentences = [
      ...getSentencesFor(word),
      ...getSentencesFor(readingBase),
    ].filter((s, i, arr) => arr.indexOf(s) === i);

    const full = state.vocabResults.find((r) => {
      const jp = (r.japanese && r.japanese[0]) || {};
      return jp.word === word || jp.reading === word;
    });
    const meanings = full
      ? (full.senses || []).flatMap((s) => s.english_definitions || [])
      : [];
    const pos =
      full && full.senses && full.senses[0]
        ? (full.senses[0].parts_of_speech || []).join(", ")
        : "";
    const jlptRaw =
      full && full.jlpt && full.jlpt[0]
        ? full.jlpt[0].replace("jlpt-", "")
        : null;
    const level = jlptRaw || state.level;
    writeItemData(id, {
      type: "vocab",
      level,
      word,
      display: word,
      reading: readingBase,
      meanings,
    });
    const status = getStatus(id);

    body.innerHTML = `
      <div class="modal-hero">
        <div id="modalKanjiChar" class="modal-kanji-glyph" style="font-size:2.6rem;">${escapeHtml(word)}</div>
        <div class="modal-hero-meta">
          <div class="modal-hero-tags">
            ${reading ? `<span class="jlpt-tag">${escapeHtml(reading)}</span>` : ""}
            ${pos ? `<span class="stroke-count">${escapeHtml(pos)}</span>` : ""}
          </div>
          <div class="modal-meanings">
            ${
              meanings.length
                ? `<ol style="margin:0;padding-left:18px;">${meanings.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ol>`
                : "No dictionary detail cached — reopen from a fresh search."
            }
          </div>
          <div class="reading-chips" style="margin-top:8px;">
            <div class="reading-chip">
              <span class="kana">${escapeHtml(readingBase)}</span>
              <span class="romaji">${escapeHtml(toRomaji(readingBase))}</span>
            </div>
          </div>
          <div class="modal-actions">
            <button class="primary-btn" id="modalSpeak">🔊 Play sound</button>
            <button class="status-toggle" data-status-toggle-id="${id}" data-status="${status}">${statusToggleInner(status)}</button>
          </div>
        </div>
      </div>

      ${
        sentences.length
          ? `
        <div class="modal-sentences-wrap">
          <h4>Example sentences using ${escapeHtml(word)}</h4>
          <div class="sentence-list">${sentences.map(buildSentenceCardHTML).join("")}</div>
        </div>`
          : `<p class="card-meanings">No curated example sentences for this word yet.</p>`
      }
    `;

    body
      .querySelector("#modalSpeak")
      .addEventListener("click", () => speak(readingBase));
  }

  function closeModal() {
    const overlay = document.getElementById("kanjiModalOverlay");
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    window.speechSynthesis && window.speechSynthesis.cancel();
  }

  // ---- Status toggle sync + quick-filter application ----

  function refreshAllStatusToggles() {
    document.querySelectorAll("[data-status-toggle-id]").forEach((btn) => {
      const id = btn.getAttribute("data-status-toggle-id");
      const status = getStatus(id);
      btn.dataset.status = status;
      btn.innerHTML = statusToggleInner(status);
    });
  }

  function applyStatusFilter() {
    const filter = state.statusFilter;
    document.querySelectorAll("[data-item-id]").forEach((card) => {
      if (filter === "all") {
        card.classList.remove("hidden");
        return;
      }
      const id = card.getAttribute("data-item-id");
      card.classList.toggle("hidden", getStatus(id) !== filter);
    });
  }

  function refreshProgressUI() {
    const p = computeProgress(state.level);
    document.getElementById("progressPercent").textContent = `${p.percent}%`;
    document.getElementById("progressLevelName").textContent =
      state.level.toUpperCase();
    document.getElementById("countUnlearned").textContent = p.unlearned;
    document.getElementById("countLearning").textContent = p.learning;
    document.getElementById("countMastered").textContent = p.mastered;
    document.getElementById("progressBarFill").style.width = `${p.percent}%`;
  }

  /** Review Queue badge on the Flashcard Deck tab: exact count of items at
   *  the current level whose nextReviewDate has passed. */
  function refreshFlashcardDueBadge() {
    const badge = document.getElementById("flashcardDueBadge");
    if (!badge) return;
    const count = countDueReviews(state.level);
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
  }

  /* ========================================================================
     6. FLASHCARD FLIP MODE — now with time-based (Leitner-style) scheduling
     Pool = everything at the current level marked Learning or Mastered AND
     currently due (nextReviewDate <= now). Grading:
       [Again] interval -> 1 minute, always requeues within this session
       [Hard]  interval -> interval * 1.2
       [Good]  interval -> interval * 2.5
       [Easy]  interval -> interval * 4
     A Learning item auto-graduates to Mastered once its interval reaches
     SRS_GRADUATION_INTERVAL_MIN (7 days) on a successful (non-Again) grade;
     Again always demotes Mastered back to Learning, since a miss means it
     wasn't actually mastered.
     ======================================================================== */

  function buildFlashcardPool() {
    const pool = getAllTrackedItems(
      ["learning", "mastered"],
      state.level,
    ).filter(isDue);
    state.flashcardQueue = shuffleArray(pool);
    state.flashcardTotal = state.flashcardQueue.length;
  }

  function fbRow(tag, val) {
    return `<div class="fb-row"><span class="fb-tag">${escapeHtml(tag)}</span><span>${escapeHtml(val)}</span></div>`;
  }

  function flashBackHTML(item) {
    let rows = "";
    if (item.type === "kanji") {
      rows += fbRow(
        "Onyomi",
        (item.onyomi || []).map((r) => `${r} (${toRomaji(r)})`).join("、") ||
          "—",
      );
      rows += fbRow(
        "Kunyomi",
        (item.kunyomi || []).map((r) => `${r} (${toRomaji(r)})`).join("、") ||
          "—",
      );
      rows += fbRow("Meaning", (item.meanings || []).join(", ") || "—");
    } else if (item.type === "vocab") {
      rows += fbRow("Reading", item.reading || "—");
      rows += fbRow("Romaji", toRomaji(item.reading || ""));
      rows += fbRow("Meaning", (item.meanings || []).join(" / ") || "—");
    } else if (item.type === "grammar") {
      rows += fbRow("Meaning", item.meaning || "—");
      rows += fbRow("Notes", item.explanation || "—");
    }
    const sentenceSource =
      item.type === "grammar"
        ? item.example
        : getSentencesFor(item.char || item.word)[0];
    const sentenceHTML = sentenceSource
      ? `<div class="modal-sentences-wrap"><h4>Example</h4>${buildSentenceLinesHTML(sentenceSource)}</div>`
      : "";
    return `<div class="fb-glyph">${escapeHtml(item.display)}</div>${rows}${sentenceHTML}`;
  }

  function renderFlashcardArea() {
    const emptyEl = document.getElementById("flashcardEmpty");
    const areaEl = document.getElementById("flashcardArea");
    const doneEl = document.getElementById("flashcardDone");

    if (state.flashcardTotal === 0) {
      emptyEl.classList.remove("hidden");
      areaEl.classList.add("hidden");
      doneEl.classList.add("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    if (state.flashcardQueue.length === 0) {
      areaEl.classList.add("hidden");
      doneEl.classList.remove("hidden");
      return;
    }
    doneEl.classList.add("hidden");
    areaEl.classList.remove("hidden");

    const item = state.flashcardQueue[0];
    document.getElementById("flashcardProgressLabel").textContent =
      `${state.flashcardTotal - state.flashcardQueue.length + 1} / ${state.flashcardTotal}`;
    document.getElementById("flashcardIntervalLabel").textContent =
      `current interval: ${formatInterval(getSchedule(item.id).interval)}`;
    document.getElementById("flipCardFront").innerHTML =
      `<span>${escapeHtml(item.display)}</span>`;
    document.getElementById("flipCardBack").innerHTML = flashBackHTML(item);
    document.getElementById("flipCard").classList.remove("flipped");
  }

  function gradeFlashcard(grade) {
    const item = state.flashcardQueue[0];
    if (!item) return;
    const currentStatus = getStatus(item.id);
    const { interval: curInterval } = getSchedule(item.id);
    const now = Date.now();

    if (grade === "again") {
      // A miss means it wasn't actually mastered — back to the Learning
      // pool, interval resets to the shortest possible gap, and it's
      // requeued so the learner can retry it again within this session.
      if (currentStatus === "mastered") setStatus(item.id, "learning");
      updateSchedule(
        item.id,
        SRS_AGAIN_INTERVAL_MIN,
        now + SRS_AGAIN_INTERVAL_MIN * 60000,
      );
      state.flashcardQueue.push(state.flashcardQueue.shift());
    } else {
      const multiplier =
        grade === "hard"
          ? SRS_HARD_MULTIPLIER
          : grade === "easy"
            ? SRS_EASY_MULTIPLIER
            : SRS_GOOD_MULTIPLIER; // "good" (and any other value) falls back to the Good multiplier
      const newInterval = curInterval * multiplier;
      updateSchedule(item.id, newInterval, now + newInterval * 60000);

      // Graduate out of Learning once the interval has stretched out far
      // enough that the item is, practically speaking, mastered.
      if (newInterval >= SRS_GRADUATION_INTERVAL_MIN)
        setStatus(item.id, "mastered");
      else if (currentStatus !== "learning") setStatus(item.id, "learning");

      state.flashcardQueue.shift(); // Hard/Good/Easy all leave the session queue
    }

    refreshFlashcardDueBadge();
    renderFlashcardArea();
  }

  /* ========================================================================
     7. PRACTICE QUIZ ENGINE  (NEW)
     Three question types drawn at random from the Learning/Mastered pool:
     meaning matching, reading recognition, and fill-in-the-blank sentence
     completion (using the curated sentence/grammar examples). Distractors
     are sampled from the rest of the pool first, padded from a small
     fallback bank if the pool is too small for four distinct options.
     ======================================================================== */

  const FALLBACK_MEANINGS = [
    "book",
    "water",
    "mountain",
    "friend",
    "tomorrow",
    "money",
    "question",
    "answer",
    "weather",
    "station",
  ];
  const FALLBACK_READINGS = [
    "tanoshii",
    "benkyou",
    "shigoto",
    "densha",
    "gakkou",
    "kaisha",
  ];

  function padDistractors(existing, fallbackBank, exclude) {
    const out = [...existing];
    const bank = shuffleArray(
      fallbackBank.filter((f) => !exclude.includes(f) && !out.includes(f)),
    );
    let i = 0;
    while (out.length < 3 && i < bank.length) out.push(bank[i++]);
    return out;
  }

  function buildMeaningQuestion(item, pool) {
    const correct =
      (item.meanings && item.meanings[0]) || item.meaning || "unknown";
    let distractors = sampleDistinct(
      pool
        .filter((p) => p.id !== item.id)
        .map((p) => (p.meanings && p.meanings[0]) || p.meaning),
      3,
    ).filter((m) => m !== correct);
    distractors = padDistractors(distractors, FALLBACK_MEANINGS, [correct]);
    const options = shuffleArray([correct, ...distractors]);
    return {
      prompt: `What does “${item.display}” mean?`,
      glyph: item.display,
      options,
      correctAnswer: correct,
      item,
    };
  }

  function buildReadingQuestion(item, pool) {
    const rawReading =
      item.type === "kanji" ? item.kunyomi[0] || item.onyomi[0] : item.reading;
    const correct = toRomaji(rawReading || "");
    let distractors = sampleDistinct(
      pool
        .filter(
          (p) => p.id !== item.id && (p.type === "kanji" || p.type === "vocab"),
        )
        .map((p) =>
          p.type === "kanji" ? p.kunyomi[0] || p.onyomi[0] : p.reading,
        )
        .filter(Boolean)
        .map(toRomaji),
      3,
    ).filter((r) => r !== correct);
    distractors = padDistractors(distractors, FALLBACK_READINGS, [correct]);
    const options = shuffleArray([correct, ...distractors]);
    return {
      prompt: `How do you read “${item.display}”?`,
      glyph: item.display,
      options,
      correctAnswer: correct,
      item,
    };
  }

  function buildFillBlankQuestion(item, pool, sentence) {
    const blankTarget =
      item.type === "grammar" ? item.pattern : item.char || item.word;
    const blanked = escapeHtml(sentence.kanjiKana)
      .split(escapeHtml(blankTarget))
      .join("＿＿＿");
    let distractors = sampleDistinct(
      pool.filter((p) => p.id !== item.id).map((p) => p.display),
      3,
    );
    distractors = padDistractors(distractors, FALLBACK_MEANINGS, [blankTarget]); // last-resort filler only
    const options = shuffleArray([blankTarget, ...distractors.slice(0, 3)]);
    return {
      prompt: "Fill in the blank:",
      sentenceHTML: blanked,
      englishHint: sentence.english,
      options,
      correctAnswer: blankTarget,
      item,
      isFillBlank: true,
    };
  }

  function buildQuizQuestions(pool, count) {
    const questions = [];
    for (let i = 0; i < count; i++) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      const candidateTypes = ["meaning"];
      if (item.type === "kanji" || item.type === "vocab")
        candidateTypes.push("reading");
      const sentence =
        item.type === "grammar"
          ? item.example
          : getSentencesFor(item.char || item.word)[0];
      if (sentence) candidateTypes.push("fillblank");

      const type =
        candidateTypes[Math.floor(Math.random() * candidateTypes.length)];
      if (type === "meaning") questions.push(buildMeaningQuestion(item, pool));
      else if (type === "reading")
        questions.push(buildReadingQuestion(item, pool));
      else questions.push(buildFillBlankQuestion(item, pool, sentence));
    }
    return questions;
  }

  function enterQuizMode() {
    document.getElementById("quizSummary").classList.add("hidden");
    document.getElementById("quizArea").classList.add("hidden");
    const pool = getAllTrackedItems(["learning", "mastered"], state.level);
    if (pool.length < 4) {
      document.getElementById("quizEmpty").classList.remove("hidden");
      document.getElementById("quizStartArea").classList.add("hidden");
    } else {
      document.getElementById("quizEmpty").classList.add("hidden");
      document.getElementById("quizStartArea").classList.remove("hidden");
    }
  }

  function startQuizRound() {
    const pool = getAllTrackedItems(["learning", "mastered"], state.level);
    if (pool.length < 4) {
      enterQuizMode();
      return;
    }
    document.getElementById("quizEmpty").classList.add("hidden");
    document.getElementById("quizStartArea").classList.add("hidden");
    document.getElementById("quizSummary").classList.add("hidden");
    document.getElementById("quizArea").classList.remove("hidden");

    const count = Math.min(10, pool.length * 2);
    state.quizSession = {
      questions: buildQuizQuestions(pool, count),
      index: 0,
      score: 0,
      missed: [],
      answered: false,
    };
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const { questions, index, score } = state.quizSession;
    const q = questions[index];
    state.quizSession.answered = false;
    document.getElementById("quizQuestionLabel").textContent =
      `Question ${index + 1} / ${questions.length}`;
    document.getElementById("quizScoreLabel").textContent = `Score: ${score}`;

    const card = document.getElementById("quizQuestionCard");
    let html = "";
    if (q.isFillBlank) {
      html += `<div class="quiz-prompt-context">${escapeHtml(q.prompt)}</div>`;
      html += `<div class="quiz-prompt-sentence">${q.sentenceHTML.replace("＿＿＿", '<span class="quiz-blank">＿＿＿</span>')}</div>`;
      html += `<div class="quiz-prompt-context">${escapeHtml(q.englishHint)}</div>`;
    } else {
      html += `<div class="quiz-prompt-glyph">${escapeHtml(q.glyph)}</div>`;
      html += `<div class="quiz-prompt-context">${escapeHtml(q.prompt)}</div>`;
    }
    html += `<div class="quiz-options">${q.options
      .map(
        (opt) =>
          `<button class="quiz-option" data-answer="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`,
      )
      .join("")}</div>`;
    html += `<div class="quiz-next-row"><button class="secondary-btn hidden" id="quizNextBtn">Next question →</button></div>`;
    card.innerHTML = html;
  }

  function handleQuizAnswer(btn) {
    const session = state.quizSession;
    if (!session || session.answered) return;
    const q = session.questions[session.index];
    const chosen = btn.getAttribute("data-answer");
    session.answered = true;
    const correct = chosen === q.correctAnswer;
    if (correct) session.score++;
    else session.missed.push(q);

    document.querySelectorAll(".quiz-option").forEach((o) => {
      o.disabled = true;
      if (o.getAttribute("data-answer") === q.correctAnswer)
        o.classList.add("correct");
      else if (o === btn) o.classList.add("incorrect");
    });
    document.getElementById("quizScoreLabel").textContent =
      `Score: ${session.score}`;
    document.getElementById("quizNextBtn").classList.remove("hidden");
  }

  function advanceQuiz() {
    const session = state.quizSession;
    session.index++;
    if (session.index >= session.questions.length) renderQuizSummary();
    else renderQuizQuestion();
  }

  function renderQuizSummary() {
    document.getElementById("quizArea").classList.add("hidden");
    const el = document.getElementById("quizSummary");
    el.classList.remove("hidden");
    const { score, questions, missed } = state.quizSession;
    el.innerHTML = `
      <h3>Round complete — ${score} / ${questions.length}</h3>
      <p>${missed.length === 0 ? "Perfect round! 🎉" : "Review these before your next round:"}</p>
      ${missed.map((m) => `<div class="missed-item"><strong>${escapeHtml(m.glyph || m.item.display)}</strong> — correct answer: ${escapeHtml(m.correctAnswer)}</div>`).join("")}
      <div style="margin-top:16px;"><button class="primary-btn" id="quizRestartBtn">Start another round</button></div>
    `;
    document
      .getElementById("quizRestartBtn")
      .addEventListener("click", startQuizRound);
  }

  /* ========================================================================
     8. EXPORT / IMPORT PROGRESS  (NEW)
     ======================================================================== */

  function exportProgress() {
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(STATUS_PREFIX) || key.startsWith(DATA_PREFIX))
        dump[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tsuzuri-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Progress exported");
  }

  function importProgressFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        let count = 0;
        Object.entries(parsed).forEach(([key, val]) => {
          if (key.startsWith(STATUS_PREFIX) || key.startsWith(DATA_PREFIX)) {
            localStorage.setItem(key, val);
            count++;
          }
        });
        toast(`Imported ${count} records`);
        refreshProgressUI();
        refreshAllStatusToggles();
        applyStatusFilter();
        refreshFlashcardDueBadge();
      } catch {
        toast("That file doesn't look like a valid Tsuzuri progress export");
      }
    };
    reader.readAsText(file);
  }

  /* ========================================================================
     9. EVENT WIRING / BOOTSTRAP
     ======================================================================== */

  function setSearchStatus(text, cls = "") {
    const el = document.getElementById("searchStatus");
    el.textContent = text;
    el.className = "search-status" + (cls ? ` ${cls}` : "");
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function switchMode(mode) {
    state.mode = mode;
    document.querySelectorAll(".mode-tab").forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".mode-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `panel-${mode}`);
    });

    // Search bar and Explorer sub-tabs are only meaningful inside Explorer mode
    document
      .querySelector(".search-row")
      .classList.toggle("hidden", mode !== "explorer");
    document
      .getElementById("explorerSubtabs")
      .classList.toggle("hidden", mode !== "explorer");

    if (mode === "gridview") renderGridView();
    if (mode === "reading") renderReadingStory();
    if (mode === "flashcard") {
      refreshFlashcardDueBadge();
      buildFlashcardPool();
      renderFlashcardArea();
    }
    if (mode === "quiz") enterQuizMode();
  }

  function switchExplorerSubtab(tab) {
    state.explorerTab = tab;
    document
      .querySelectorAll(".subtab")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.subtab === tab),
      );
    document
      .querySelectorAll(".explorer-subpanel")
      .forEach((panel) =>
        panel.classList.toggle("active", panel.id === `explorer-${tab}`),
      );

    const query = document.getElementById("universalSearch").value;
    if (tab === "kanji" && !state.kanjiListsByLevel[state.level])
      loadKanjiLevelList();
    else if (tab === "kanji") applyStatusFilter();
    if (tab === "vocab") searchVocab(query);
    if (tab === "grammar") renderGrammarGrid();
    if (tab === "sentence") renderSentenceBank(query);
  }

  async function switchLevel(level) {
    state.level = level;
    await ensureKanjiList(level).catch(() => {});
    refreshProgressUI();
    refreshFlashcardDueBadge();
    updateAddAllButtonLabel();
    if (state.mode === "explorer") {
      if (state.explorerTab === "kanji") loadKanjiLevelList();
      else if (state.explorerTab === "vocab")
        searchVocab(document.getElementById("universalSearch").value);
      else if (state.explorerTab === "grammar") renderGrammarGrid();
    } else if (state.mode === "gridview") {
      renderGridView();
    } else if (state.mode === "reading") {
      renderReadingStory();
    } else if (state.mode === "flashcard") {
      buildFlashcardPool();
      renderFlashcardArea();
    } else if (state.mode === "quiz") {
      enterQuizMode();
    }
  }

  function handleSearchInput(rawValue) {
    state.query = rawValue;
    document
      .getElementById("clearSearch")
      .classList.toggle("visible", rawValue.length > 0);
    if (state.explorerTab === "kanji") handleKanjiSearch(rawValue);
    else if (state.explorerTab === "vocab") searchVocab(rawValue);
    else if (state.explorerTab === "sentence") renderSentenceBank(rawValue);
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute(
      "data-theme",
      theme === "paper" ? "paper" : "ink",
    );
    localStorage.setItem("tsuzuri_theme", theme);
  }

  function setupEventListeners() {
    document
      .getElementById("levelSelect")
      .addEventListener("change", (e) => switchLevel(e.target.value));

    document.getElementById("themeToggle").addEventListener("click", () => {
      applyTheme(state.theme === "ink" ? "paper" : "ink");
    });

    document.querySelectorAll(".mode-tab").forEach((btn) => {
      btn.addEventListener("click", () => switchMode(btn.dataset.mode));
    });

    document.querySelectorAll(".subtab").forEach((btn) => {
      btn.addEventListener("click", () =>
        switchExplorerSubtab(btn.dataset.subtab),
      );
    });

    document.querySelectorAll(".filter-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.statusFilter = btn.dataset.filter;
        document
          .querySelectorAll(".filter-chip")
          .forEach((c) => c.classList.toggle("active", c === btn));
        applyStatusFilter();
      });
    });

    const searchInput = document.getElementById("universalSearch");
    const debouncedSearch = debounce((val) => handleSearchInput(val), 350);
    searchInput.addEventListener("input", (e) =>
      debouncedSearch(e.target.value),
    );

    document.getElementById("clearSearch").addEventListener("click", () => {
      searchInput.value = "";
      searchInput.focus();
      handleSearchInput("");
      document.getElementById("clearSearch").classList.remove("visible");
    });

    document
      .getElementById("kanjiLoadMore")
      .addEventListener("click", renderNextKanjiBatch);
    document
      .getElementById("addAllToDeckBtn")
      .addEventListener("click", addAllToDeck);

    // Reading Practice: master furigana switch just toggles a CSS class,
    // no re-render needed since the ruby markup is already in the DOM.
    document
      .getElementById("furiganaToggle")
      .addEventListener("change", (e) => {
        document
          .getElementById("readingStory")
          .classList.toggle("furigana-hidden", !e.target.checked);
      });

    // Export / import
    document
      .getElementById("exportBtn")
      .addEventListener("click", exportProgress);
    document
      .getElementById("importBtn")
      .addEventListener("click", () =>
        document.getElementById("importFile").click(),
      );
    document.getElementById("importFile").addEventListener("change", (e) => {
      if (e.target.files[0]) importProgressFile(e.target.files[0]);
      e.target.value = "";
    });

    // Flashcard controls
    document.getElementById("flipCard").addEventListener("click", () => {
      document.getElementById("flipCard").classList.toggle("flipped");
    });
    document.querySelectorAll(".grade-btn").forEach((btn) => {
      btn.addEventListener("click", () => gradeFlashcard(btn.dataset.grade));
    });
    document
      .getElementById("flashcardShuffle")
      .addEventListener("click", () => {
        state.flashcardQueue = shuffleArray(state.flashcardQueue);
        renderFlashcardArea();
      });

    // Quiz controls
    document
      .getElementById("quizStartBtn")
      .addEventListener("click", startQuizRound);

    // Delegated clicks: cards, status toggles, speak buttons, quiz options/next
    document.addEventListener("click", (e) => {
      const statusBtn = e.target.closest("[data-status-toggle-id]");
      const speakBtn = e.target.closest("[data-speak]");
      const quizOption = e.target.closest(".quiz-option");
      const quizNext = e.target.closest("#quizNextBtn");
      const kanjiCard = e.target.closest(".kanji-card");
      const vocabCard = e.target.closest(".vocab-card");
      const miniCard = e.target.closest(".mini-kanji-card:not(.is-loading)");
      const dokkaiSentence = e.target.closest(".dokkai-sentence");

      if (statusBtn) {
        e.stopPropagation();
        const id = statusBtn.getAttribute("data-status-toggle-id");
        setStatus(id, cycleStatus(getStatus(id)));
        return;
      }
      if (speakBtn) {
        e.stopPropagation();
        speak(speakBtn.getAttribute("data-speak"));
        return;
      }
      if (quizOption) {
        handleQuizAnswer(quizOption);
        return;
      }
      if (quizNext) {
        advanceQuiz();
        return;
      }
      if (kanjiCard) {
        openKanjiModal(kanjiCard.dataset.char);
        return;
      }
      if (vocabCard) {
        openVocabModal(vocabCard.dataset.word, vocabCard.dataset.reading);
        return;
      }
      if (miniCard) {
        openKanjiModal(miniCard.dataset.char);
        return;
      }
      if (dokkaiSentence) {
        toggleDokkaiTranslation(dokkaiSentence);
        return;
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const kanjiCard = e.target.closest(".kanji-card");
      const vocabCard = e.target.closest(".vocab-card");
      const miniCard = e.target.closest(".mini-kanji-card:not(.is-loading)");
      const dokkaiSentence = e.target.closest(".dokkai-sentence");
      if (kanjiCard) {
        e.preventDefault();
        openKanjiModal(kanjiCard.dataset.char);
      }
      if (vocabCard) {
        e.preventDefault();
        openVocabModal(vocabCard.dataset.word, vocabCard.dataset.reading);
      }
      if (miniCard) {
        e.preventDefault();
        openKanjiModal(miniCard.dataset.char);
      }
      if (dokkaiSentence) {
        e.preventDefault();
        toggleDokkaiTranslation(dokkaiSentence);
      }
    });

    document.getElementById("closeModal").addEventListener("click", closeModal);
    document
      .getElementById("kanjiModalOverlay")
      .addEventListener("click", (e) => {
        if (e.target.id === "kanjiModalOverlay") closeModal();
      });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  async function init() {
    const savedTheme = localStorage.getItem("tsuzuri_theme") || "ink";
    applyTheme(savedTheme);
    setupEventListeners();
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();

    await ensureKanjiList(state.level).catch(() => {});
    refreshProgressUI();
    refreshFlashcardDueBadge();
    updateAddAllButtonLabel();
    // The due count changes purely with the passage of time (a card graded
    // [Again] becomes due again after just 1 minute), so re-check it
    // periodically even if the learner doesn't touch anything.
    setInterval(refreshFlashcardDueBadge, 30000);
    loadKanjiLevelList();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
