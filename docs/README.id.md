Follows README version 0.4

# Stashpad

**Kerja bagus. Layak diingat.**

**Memori lokal untuk agen coding AI apa pun: server MCP dan CLI yang menyimpan catatan Markdown biasa beserta sumbernya, antrean peninjauan, dan pencarian.**

Bekerja dengan Claude Code, Codex, OpenCode, Cursor, VS Code, Gemini CLI, dan klien MCP lainnya, atau tanpa MCP sama sekali (perintah biasa dan blok `AGENTS.md`). Tanpa model, tanpa cloud, tanpa dependensi: Node 20 atau lebih baru.

## Mulai Cepat

```bash
npm install -g stashpad
stashpad setup                  # prints the MCP settings for your agent app (generic, claude-code, vscode, codex, opencode)
stashpad doctor --client        # starts the server the way your agent app does and checks it answers
```

Yang diharapkan: `client start: the server answered with 8 tools in ... ms` (server menjawab dengan 8 tool dalam ... ms) dan `Nothing is broken.` (tidak ada yang rusak).

Pengguna Claude Code dapat memasang plugin sebagai gantinya, yang juga menambahkan hooks di bawah ini: `/plugin marketplace add laaielichter/stashpad`, lalu `/plugin install stashpad@stashpad` (atau `stashpad@reverseport` dari [marketplace ReversePort](../README.md#sister-tools)).

## Mengapa Stashpad?

- **Agen Anda berhenti lupa setelah compaction.** Aturan yang dipin dan handoff terbaru kembali di awal setiap sesi dan tepat setelah `/compact`.
- **Aturan yang Anda tetapkan tetap berada di hadapan agen.** `stashpad pin` menjaga beberapa aturan yang penting dalam setiap brief; setiap prompt hanya mendapatkan memori yang jelas cocok, sekali per sesi.
- **Memori yang tahu ketika kode sudah berubah.** Tautkan memori ke file-nya dan recall akan mengatakan "changed since saved" (berubah sejak disimpan), mengikuti file yang diganti namanya, dan melewati memori yang file-nya sudah hilang. Keputusan menyimpan alasan dibuatnya dan apa yang dikalahkan (`stashpad decide`).
- **Tidak ada yang masuk ke memori tanpa sepengetahuan Anda.** Catatan agen, tool, dan web menunggu seseorang; salinan yang hampir sama, rahasia, dan teks tersembunyi ditolak.
- **Anda bisa membaca, memperbaiki, dan menyimpannya.** Memori adalah file Markdown dengan sumber dan tanggal, di proyek Anda, di git jika mau. Fakta lama diakhiri, tidak pernah ditimpa.
- **Anda melihat apa yang diterima agen.** `stashpad shown` menampilkan memori mana yang diberikan kepada agen dan berapa karakternya, dan status line menjaga antrean peninjauan tetap terlihat.
- **Terus bekerja.** Satu store per proyek (worktree berbagi store yang sama), lock untuk penulis paralel, snapshot sebelum perubahan, `doctor` yang mengatakan apa yang harus diperbaiki.

## Awal dan akhir sesi

```bash
stashpad brief                  # short summary: pinned rules, newest memories, open handoff
stashpad recall "add a postgres migration"    # the few memories that clearly match a request (project first, then global)
stashpad decide "We use Postgres" --why "several workers write at once" --rejected SQLite   # a decision with its reason
stashpad handoff leave --text "Half done: auth. Next: tests."   # a note the next session reads once
stashpad sync-agents AGENTS.md  # put the brief in a file agents already read (no MCP needed)
```

Dengan plugin Claude Code, perintah-perintah ini berjalan sebagai hooks: saat sesi dimulai dan setelah compaction, pada setiap prompt (setiap memori sekali per sesi), dan sebelum compaction serta di akhir sesi (handoff otomatis berisi branch dan file yang belum di-commit; sesi yang crash akan ketahuan saat sesi berikutnya dimulai). Jeda hooks per proyek dengan `stashpad hooks off`; tambahkan `stashpad setup claude-code --status-line` untuk baris status. Lihat [docs/HOOKS.md](HOOKS.md). Agen: baca [AGENT-GUIDE.md](../AGENT-GUIDE.md).

Untuk yang lainnya, lihat [README berbahasa Inggris](../README.md).
