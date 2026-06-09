# Notes & Decisions Log

## 2026-06-05: External Review Feedback

**Score**: 8/10 ý tưởng + trình bày | 6.5/10 khả thi solo 10 ngày

### Điểm mạnh
- Scope đóng khung rõ, bám track tốt
- Không chỉ chatbot — có kiến trúc, UX flow, plan end-to-end
- AI dùng đúng vai trò "ra quyết định có ngữ cảnh", memory ảnh hưởng hành vi hệ thống
- UX nhất quán: preview step-by-step, confirm rõ, warning ngôn ngữ tự nhiên

### Điểm yếu cần xử lý
1. **Scope quá tham** cho 10 ngày solo (4 intents + 3 AI layers + 4 risk classes + behavioral + memory panel + polish)
2. **AI có thể over-engineered** — 3 LLM calls/interaction = latency + điểm lỗi
3. **Thiếu phân biệt rõ** MVP bắt buộc vs stretch goal

### Quyết định: MVP "Ship or Die"

**Giữ**:
- 1 intent chính: **Swap** (showcase route + slippage + PTB atomic)
- 1 intent phụ: **Stake** (chứng minh extensible)
- Guardian: **2 risks** (slippage + concentration) — đủ yêu cầu track
- MemWal: **remember + recall** — đủ yêu cầu Walrus track
- **1 LLM call duy nhất** (merge reasoning + risk) — giảm latency 5s → 3s

**Cắt**:
- Yield deposit (Scallop) — dependency cao
- Transfer — không showcase AI/Sui
- DCA — cần scheduling
- AI Layer 3 (Behavioral) — thêm nếu kịp
- Memory panel sidebar — memory indicator trong chat đủ
- Mobile responsive — desktop-only
- Multi-step PTB — P1

**Nguyên tắc build**: Mỗi ngày kết thúc phải demo được. Day 4 = MVP submittable.

### Kiến trúc đơn giản hóa

```
1 LLM call (intent reasoning + risk flags)
     + recalled memories
     + on-chain data (balances, routes, prices)
           │
           ▼
PTB Compiler (deterministic, Sui-specific)
           │
           ▼
Preview + Confirm → Execute → Remember
```

---

## Submission Checklist (from Handbook)

| Field | Requirement | Status |
|-------|-------------|--------|
| Project Name | Clear + simple | ⬜ "Marina Copilot" |
| Description | What it does, why it matters | ⬜ |
| Project Logo | 1:1 ratio (JPG/PNG) | ⬜ |
| Public GitHub Repo | Required public during judging | ⬜ |
| Demo Video | YouTube preferred, ≤ 5 min | ⬜ |
| Website | Optional, highly recommended | ⬜ Vercel deploy |
| Deployment | Testnet or Mainnet | ⬜ Sui Testnet |
| Package ID | If deployed on-chain | ⬜ N/A (uses existing protocols) |

### Eligibility Rules
- Must be **built during May 7 – June 21, 2026**
- Must be **deployed to testnet/mainnet** at shortlisting + demo day
- Existing projects OK only if **substantial new functionality** added during hackathon

### Pre-Submit Checks
- [ ] GitHub repo set to **public**
- [ ] README has: setup instructions, architecture, tech stack, demo link
- [ ] Demo video ≤ 5min uploaded to YouTube
- [ ] App deployed and accessible (Vercel + Lambda)
- [ ] App works on Sui Testnet (swap executes, memory persists)
- [ ] No hardcoded secrets in repo
- [ ] .env.example file with required vars listed

---

## TODO sau khi build xong
- [ ] Đánh giá lại scope: thêm Stake? thêm Behavioral? thêm Memory panel?
- [ ] Review demo video script
- [ ] Final submission on DeepSurge platform
