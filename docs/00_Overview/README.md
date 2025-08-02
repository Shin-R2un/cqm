# CQM Documentation Vault

このフォルダは **CQ Models!** プロジェクトの設計文書を管理するObsidian Vaultです。

## 📁 フォルダ構成

| フォルダ | 内容 | 主な文書例 |
|---------|------|-----------|
| `00_Overview/` | プロジェクト概要 | README, ガイドライン |
| `01_Requirements/` | 要件定義 | 要件定義書、ユースケース |
| `02_Architecture/` | システム設計 | アーキテクチャ、データモデル |
| `03_Technical/` | 技術設計 | 詳細設計、API仕様 |
| `04_MCP/` | MCP仕様 | 統合仕様、アダプター設計 |
| `05_Implementation/` | 実装ガイド | セットアップ、設定 |
| `06_Development/` | 開発ガイド | コーディング規約、テスト |
| `07_Examples/` | 使用例 | チュートリアル、設定例 |
| `08_Reference/` | リファレンス | CLI、API、プラグイン |
| `09_Tasks/` | タスク管理 | Phase別タスクリスト |
| `10_Decisions/` | 決定記録 | ADR、技術選定 |
| `11_Testing/` | テスト関連 | テスト戦略、品質保証 |
| `12_Policies/` | ポリシー | ガイドライン、セキュリティ |
| `90_Meeting_Notes/` | 議事録 | ミーティング記録 |
| `99_Archive/` | アーカイブ | 旧バージョン文書 |

## 🏷️ タグ体系

### 基本タグ
- `#CQM/Project` - プロジェクト全般
- `#CQM/Planning` - 計画フェーズ
- `#CQM/Implementation` - 実装フェーズ

### 文書種別タグ
- `#CQM/Requirements` - 要件定義
- `#CQM/Architecture` - アーキテクチャ
- `#CQM/Technical` - 技術設計
- `#CQM/MCP` - MCP仕様

## 📝 文書作成方法

1. **新規文書作成時**:
   - 適切なテンプレートを選択
   - 文書番号を採番（`CQM-[CAT]-XXX`）
   - Frontmatterを記入

2. **文書番号ルール**:
   ```
   CQM-[カテゴリ]-[連番]-[バージョン]_[タイトル].md
   例: CQM-REQ-001-v1.0_要件定義書.md
   ```

3. **テンプレート**:
   - 要件定義: `requirement-template.md`
   - 技術設計: `technical-template.md`
   - MCP仕様: `mcp-template.md`
   - ADR: `adr-template.md`

## 🔍 推奨Obsidianプラグイン

### コアプラグイン
- ✅ ファイルエクスプローラー
- ✅ 検索
- ✅ タグペイン
- ✅ テンプレート
- ✅ バックリンク
- ✅ グラフビュー

### コミュニティプラグイン
- **Dataview**: 文書一覧の自動生成
- **Templater**: 高度なテンプレート機能
- **Git**: バージョン管理統合

## 📋 品質チェックリスト

### 文書作成時
- [ ] 適切なフォルダに配置
- [ ] 文書番号が正しく採番されている
- [ ] Frontmatterが完全に記入されている
- [ ] 必要なタグが付与されている
- [ ] 関連文書との参照関係が設定されている

### レビュー時
- [ ] 技術的正確性
- [ ] 完全性
- [ ] 一貫性
- [ ] 可読性

---

## 🚀 次のステップ

1. [要件定義書](../01_Requirements/CQM-REQ-001-v1.1_要件定義書.md)の確認
2. [文書管理ガイドライン](../12_Policies/CQM-POL-001_文書管理ガイドライン.md)の詳細確認
3. 実装フェーズの設計文書作成開始

---

*"CQ CQ CQ, calling all models! - 統一されたコンテキストで、すべてのAIモデルが連携する世界へ"*