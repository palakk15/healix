import type { CommunityComment, CommunityPost, CommunityPostSummary, CommunityTopicId } from "@core/api/schemas/community";
import { communityTopicIds } from "@core/api/schemas/community";
import { aliasFor, findContentProblem } from "@core/domain/communityRules";
import type { User } from "@core/api/schemas/backend";
import type { MockClock } from "./clock";
import { MockError } from "./errors";

interface StoredComment {
  id: string;
  authorId: string;
  authorAlias: string;
  body: string;
  createdAtMs: number;
}

interface StoredPost {
  id: string;
  topicId: CommunityTopicId;
  authorId: string;
  authorAlias: string;
  title: string;
  body: string;
  createdAtMs: number;
  baseScore: number;
  votes: Record<string, 1 | -1>;
  comments: StoredComment[];
  reports: string[];
}

export interface CommunitySnapshot {
  posts: StoredPost[];
  counters: { post: number; comment: number };
}

interface SeedComment {
  alias: string;
  body: string;
  minutesAgo: number;
}

interface SeedPost {
  topic: CommunityTopicId;
  alias: string;
  title: string;
  body: string;
  minutesAgo: number;
  score: number;
  comments: SeedComment[];
}

const seeds: SeedPost[] = [
  {
    topic: "diabetes",
    alias: "Calm Heron",
    title: "My HbA1c came down from 7.9 to 7.1 in five months",
    body: "Sharing in case it helps someone. I started walking for 30 minutes after dinner, swapped white rice for a smaller portion with dal and vegetables, and never skipped my check-ups. It was slow, but the number moved. What small habit worked for you?",
    minutesAgo: 60 * 5,
    score: 42,
    comments: [
      { alias: "Brave Tiger", body: "The after-dinner walk made the biggest difference for me too. Even 15 minutes counts.", minutesAgo: 60 * 4 },
      { alias: "Gentle Maina", body: "Congratulations! I keep a small notebook with my readings and show it to my doctor every visit.", minutesAgo: 60 * 3 },
    ],
  },
  {
    topic: "diabetes",
    alias: "Patient Sparrow",
    title: "What is the difference between fasting sugar and HbA1c?",
    body: "My report shows both and my doctor only talked about one of them. I understand fasting is after not eating, but what does HbA1c tell me that the fasting number does not?",
    minutesAgo: 60 * 20,
    score: 27,
    comments: [
      { alias: "Wise Crane", body: "Fasting is a snapshot of that morning. HbA1c is more like an average of the last two to three months, so one bad day does not change it much. The report assistant in Healix explains this well too.", minutesAgo: 60 * 18 },
    ],
  },
  {
    topic: "diabetes",
    alias: "Kind Deer",
    title: "Foot care tips that my diabetes nurse taught me",
    body: "Look at your feet every evening, dry between the toes, wear soft footwear even at home, and show any small wound early instead of waiting. A small cut can become a big problem when sugar is high.",
    minutesAgo: 60 * 52,
    score: 35,
    comments: [],
  },
  {
    topic: "heart",
    alias: "Steady Otter",
    title: "How do you keep salt low without food tasting boring?",
    body: "Doctor asked me to cut salt after my blood pressure readings went up. I am struggling because everything tastes flat. Lemon helps a little. Any ideas from Indian kitchens?",
    minutesAgo: 60 * 8,
    score: 31,
    comments: [
      { alias: "Warm Lotus", body: "Roasted jeera, curry leaves, a little amchur and fresh coriander make a big difference. Your taste adjusts in about two weeks.", minutesAgo: 60 * 6 },
      { alias: "Cheerful Parrot", body: "Check packaged foods like pickles and papad, they carry a lot of hidden salt.", minutesAgo: 60 * 5 },
    ],
  },
  {
    topic: "heart",
    alias: "Quiet Crane",
    title: "Chest discomfort while climbing stairs: when did you decide to see a doctor?",
    body: "I have been feeling a tightness when I climb two floors. It goes away when I rest. I keep postponing a check-up. Please be honest, should I wait?",
    minutesAgo: 60 * 30,
    score: 18,
    comments: [
      { alias: "Calm Heron", body: "Please do not wait. Tightness on effort is something doctors want to see soon. If it ever comes with sweating, pain spreading to the arm or breathlessness at rest, call 112 straight away.", minutesAgo: 60 * 29 },
    ],
  },
  {
    topic: "women",
    alias: "Bright Koel",
    title: "Iron-rich food that actually fits a vegetarian thali",
    body: "My haemoglobin was on the lower side. Jaggery, green leafy vegetables, sprouts and lemon with meals are helping. I avoid tea right after eating because it reduces absorption. Sharing what worked for me, what about you?",
    minutesAgo: 60 * 14,
    score: 24,
    comments: [
      { alias: "Gentle Deer", body: "Til laddoo and beetroot salad are my favourites. Retesting after three months showed a nice rise.", minutesAgo: 60 * 10 },
    ],
  },
  {
    topic: "women",
    alias: "Sunny Elephant",
    title: "Feeling very tired all the time, is it normal after 40?",
    body: "I sleep seven hours but wake up tired and I get irritated easily. My family says it is just age. I am wondering if I should get my thyroid and vitamin levels checked.",
    minutesAgo: 60 * 60,
    score: 21,
    comments: [
      { alias: "Wise Sparrow", body: "Tiredness has many ordinary causes, and a simple blood test can rule a few out. Ask your doctor which tests make sense for you.", minutesAgo: 60 * 58 },
    ],
  },
  {
    topic: "seniors",
    alias: "Patient Crane",
    title: "Tips for managing my father's many appointments",
    body: "My father is 78 with sugar and blood pressure. Between reports, lab visits and clinic queues I am losing track. I now keep one folder with all reports and a list of questions before each visit. Anything else that helps?",
    minutesAgo: 60 * 11,
    score: 29,
    comments: [
      { alias: "Kind Tiger", body: "Booking the first slot of the morning and arriving a little early kept the waiting short for us. The token and leave-home reminder in the app helps a lot too.", minutesAgo: 60 * 9 },
      { alias: "Warm Maina", body: "Large print copies of the medicine schedule on the fridge, written by the doctor, saved us from many mix-ups.", minutesAgo: 60 * 7 },
    ],
  },
  {
    topic: "seniors",
    alias: "Brave Lotus",
    title: "Exercises my mother can do with knee pain",
    body: "My mother has mild knee arthritis and is afraid to move. Her physiotherapist suggested seated leg raises and short slow walks on flat ground. She feels more confident every week.",
    minutesAgo: 60 * 70,
    score: 16,
    comments: [],
  },
  {
    topic: "mind",
    alias: "Gentle Koel",
    title: "Sleep has been poor since my diagnosis scare",
    body: "After a worrying report last month I keep waking up at 3 am thinking about it. The report turned out manageable but my mind has not caught up. How do you calm down at night?",
    minutesAgo: 60 * 16,
    score: 33,
    comments: [
      { alias: "Calm Otter", body: "Writing my worries on paper before bed helped, and no phone for the last half hour. Talking to a counsellor also helped me a lot.", minutesAgo: 60 * 15 },
    ],
  },
  {
    topic: "mind",
    alias: "Cheerful Heron",
    title: "बीमारी के बारे में परिवार से खुलकर कैसे बात करें?",
    body: "मुझे हाल ही में डायबिटीज़ का पता चला है और मैं घरवालों को चिंता में नहीं डालना चाहता। क्या आप लोगों ने अपने परिवार से बात की? कैसे शुरुआत की?",
    minutesAgo: 60 * 40,
    score: 14,
    comments: [
      { alias: "Warm Parrot", body: "मैंने सबसे पहले अपनी रिपोर्ट के साथ बैठकर बात की। जब बातें साफ़ होती हैं तो घर वाले मदद करना शुरू कर देते हैं।", minutesAgo: 60 * 38 },
    ],
  },
  {
    topic: "food",
    alias: "Sunny Crane",
    title: "Healthy breakfast ideas under 10 minutes",
    body: "Poha with lots of vegetables, besan chilla, moong sprouts with lemon, or a bowl of curd with fruit and nuts. What are your quick breakfast ideas that do not spike sugar?",
    minutesAgo: 60 * 6,
    score: 26,
    comments: [
      { alias: "Patient Deer", body: "Vegetable upma with a handful of peanuts keeps me full till lunch.", minutesAgo: 60 * 5 },
    ],
  },
  {
    topic: "food",
    alias: "Quiet Parrot",
    title: "पाणी किती प्यावे? उन्हाळ्यात काय करता?",
    body: "उन्हाळ्यात मला दिवसभर थकवा जाणवतो. डॉक्टरांनी भरपूर पाणी प्यायला सांगितले आहे, पण मी विसरतो. तुम्ही कसे लक्षात ठेवता?",
    minutesAgo: 60 * 26,
    score: 11,
    comments: [
      { alias: "Brave Maina", body: "मी बाटली डोळ्यासमोर ठेवते आणि प्रत्येक तासाला थोडे पाणी पिते. ताक आणि नारळ पाणीही चांगले.", minutesAgo: 60 * 24 },
    ],
  },
];

const maxPostsPerHour = 10;
const maxCommentsPerHour = 30;
const hideAfterReports = 3;

export class CommunityStore {
  private posts = new Map<string, StoredPost>();
  private postCounter = 0;
  private commentCounter = 0;

  constructor(private readonly clock: MockClock) {
    this.reset();
  }

  reset(): void {
    this.posts.clear();
    this.postCounter = 0;
    this.commentCounter = 0;
    const now = this.clock.now().getTime();
    for (const seed of seeds) {
      this.postCounter += 1;
      const id = `post_${String(this.postCounter).padStart(4, "0")}`;
      this.posts.set(id, {
        id,
        topicId: seed.topic,
        authorId: `seed_${this.postCounter}`,
        authorAlias: seed.alias,
        title: seed.title,
        body: seed.body,
        createdAtMs: now - seed.minutesAgo * 60_000,
        baseScore: seed.score,
        votes: {},
        comments: seed.comments.map((comment) => {
          this.commentCounter += 1;
          return {
            id: `comment_${String(this.commentCounter).padStart(4, "0")}`,
            authorId: `seed_c${this.commentCounter}`,
            authorAlias: comment.alias,
            body: comment.body,
            createdAtMs: now - comment.minutesAgo * 60_000,
          };
        }),
        reports: [],
      });
    }
  }

  snapshot(): CommunitySnapshot {
    return { posts: structuredClone([...this.posts.values()]), counters: { post: this.postCounter, comment: this.commentCounter } };
  }

  restore(snapshot: CommunitySnapshot): void {
    this.posts.clear();
    for (const post of snapshot.posts) this.posts.set(post.id, post);
    this.postCounter = snapshot.counters.post;
    this.commentCounter = snapshot.counters.comment;
  }

  private visible(): StoredPost[] {
    return [...this.posts.values()].filter((post) => post.reports.length < hideAfterReports);
  }

  private score(post: StoredPost): number {
    return post.baseScore + Object.values(post.votes).reduce<number>((sum, value) => sum + value, 0);
  }

  private summary(post: StoredPost, viewerId: string): CommunityPostSummary {
    const flat = post.body.replace(/\s+/g, " ");
    return {
      id: post.id,
      topic_id: post.topicId,
      title: post.title,
      snippet: flat.length > 140 ? `${flat.slice(0, 137)}…` : flat,
      author_alias: post.authorAlias,
      created_at: new Date(post.createdAtMs).toISOString(),
      score: this.score(post),
      comment_count: post.comments.length,
      my_vote: post.votes[viewerId] ?? 0,
      mine: post.authorId === viewerId,
    };
  }

  private full(post: StoredPost, viewerId: string): CommunityPost {
    return {
      ...this.summary(post, viewerId),
      body: post.body,
      comments: post.comments
        .slice()
        .sort((a, b) => a.createdAtMs - b.createdAtMs)
        .map((comment): CommunityComment => ({
          id: comment.id,
          author_alias: comment.authorAlias,
          body: comment.body,
          created_at: new Date(comment.createdAtMs).toISOString(),
          mine: comment.authorId === viewerId,
        })),
    };
  }

  topics(): Array<{ id: CommunityTopicId; post_count: number }> {
    const visible = this.visible();
    return communityTopicIds.map((id) => ({ id, post_count: visible.filter((post) => post.topicId === id).length }));
  }

  list(viewerId: string, options: { topic?: CommunityTopicId; sort: "new" | "top"; query?: string }): CommunityPostSummary[] {
    const query = options.query?.trim().toLowerCase();
    const posts = this.visible()
      .filter((post) => (options.topic ? post.topicId === options.topic : true))
      .filter((post) => (query ? `${post.title} ${post.body}`.toLowerCase().includes(query) : true));
    posts.sort((a, b) => (options.sort === "top" ? this.score(b) - this.score(a) || b.createdAtMs - a.createdAtMs : b.createdAtMs - a.createdAtMs));
    return posts.map((post) => this.summary(post, viewerId));
  }

  get(viewerId: string, id: string): CommunityPost | undefined {
    const post = this.posts.get(id);
    return post && post.reports.length < hideAfterReports ? this.full(post, viewerId) : undefined;
  }

  private checkContent(...parts: string[]): void {
    const problem = findContentProblem(parts.join(" "));
    if (problem) throw new MockError(422, "content_not_allowed", "This text cannot be posted", false, { reason: problem });
  }

  private recent(userId: string, kind: "post" | "comment"): number {
    const since = this.clock.now().getTime() - 3_600_000;
    if (kind === "post") return [...this.posts.values()].filter((post) => post.authorId === userId && post.createdAtMs > since).length;
    return [...this.posts.values()].flatMap((post) => post.comments).filter((comment) => comment.authorId === userId && comment.createdAtMs > since).length;
  }

  create(user: User, request: { topic_id: CommunityTopicId; title: string; body: string }): CommunityPost {
    this.checkContent(request.title, request.body);
    if (this.recent(user.id, "post") >= maxPostsPerHour) throw new MockError(429, "slow_down", "Please wait a little before posting again", true);
    this.postCounter += 1;
    const post: StoredPost = {
      id: `post_${String(this.postCounter).padStart(4, "0")}`,
      topicId: request.topic_id,
      authorId: user.id,
      authorAlias: aliasFor(user.id),
      title: request.title.trim(),
      body: request.body.trim(),
      createdAtMs: this.clock.now().getTime(),
      baseScore: 1,
      votes: { [user.id]: 1 },
      comments: [],
      reports: [],
    };
    this.posts.set(post.id, post);
    return this.full(post, user.id);
  }

  comment(user: User, postId: string, body: string): CommunityPost {
    const post = this.posts.get(postId);
    if (!post || post.reports.length >= hideAfterReports) throw new MockError(404, "post_not_found", "Post not found");
    this.checkContent(body);
    if (this.recent(user.id, "comment") >= maxCommentsPerHour) throw new MockError(429, "slow_down", "Please wait a little before replying again", true);
    this.commentCounter += 1;
    post.comments.push({
      id: `comment_${String(this.commentCounter).padStart(4, "0")}`,
      authorId: user.id,
      authorAlias: aliasFor(user.id),
      body: body.trim(),
      createdAtMs: this.clock.now().getTime(),
    });
    return this.full(post, user.id);
  }

  vote(user: User, postId: string, value: 1 | -1 | 0): CommunityPostSummary {
    const post = this.posts.get(postId);
    if (!post || post.reports.length >= hideAfterReports) throw new MockError(404, "post_not_found", "Post not found");
    if (value === 0) delete post.votes[user.id];
    else post.votes[user.id] = value;
    return this.summary(post, user.id);
  }

  remove(user: User, postId: string): void {
    const post = this.posts.get(postId);
    if (!post) throw new MockError(404, "post_not_found", "Post not found");
    if (post.authorId !== user.id) throw new MockError(403, "not_yours", "You can only delete your own posts", false);
    this.posts.delete(postId);
  }

  report(user: User, postId: string): void {
    const post = this.posts.get(postId);
    if (!post) throw new MockError(404, "post_not_found", "Post not found");
    if (!post.reports.includes(user.id)) post.reports.push(user.id);
  }
}
