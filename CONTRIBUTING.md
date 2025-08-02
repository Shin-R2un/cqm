# Contributing to CQ Models!

> "CQ CQ CQ, calling all contributors!" - あなたの参加を歓迎します！

CQMプロジェクトへのコントリビューションをありがとうございます。このガイドでは、プロジェクトに貢献する方法を説明します。

## 🚀 クイックスタート

### 前提条件
- Node.js 20.x LTS 以上
- npm 10.0.0 以上
- Git 2.30 以上

### 開発環境のセットアップ

```bash
# 1. リポジトリをフォーク・クローン
git clone https://github.com/YOUR_USERNAME/cqm.git
cd cqm

# 2. 依存関係をインストール
npm install

# 3. 開発サーバーを起動
npm run dev

# 4. テストを実行
npm test
```

## 📋 コントリビューションのタイプ

### 🐛 バグレポート
- [GitHub Issues](https://github.com/Shin-R2un/cqm/issues/new?template=bug_report.md) でバグを報告
- 再現手順を詳細に記載
- 環境情報（OS、Node.jsバージョン等）を含める

### 💡 機能提案
- [GitHub Issues](https://github.com/Shin-R2un/cqm/issues/new?template=feature_request.md) で提案
- ユースケースと期待される動作を説明
- 実装可能性についてディスカッション

### 🔧 コード貢献
- 機能追加、バグ修正、パフォーマンス改善
- ドキュメントの改善
- テストの追加・改善

### 🧩 プラグイン開発
- 新しいプラグインの作成
- 既存プラグインの改善
- プラグイン開発ガイドの改善

## 🔄 開発ワークフロー

### 1. Issue作成
```bash
# 作業前にIssueを作成して作業内容を明確化
# Issue例: "Add GitHub Projects V2 integration"
```

### 2. ブランチ作成
```bash
# 命名規則: feature/issue-number-short-description
git checkout -b feature/123-github-projects-integration
```

### 3. 開発
```bash
# コードを書く
npm run dev    # 開発サーバー起動

# テストを書く
npm test       # テスト実行

# リントチェック
npm run lint   # コード品質チェック
npm run format # コード整形
```

### 4. コミット
```bash
# Conventional Commitsに従ったメッセージ
git commit -m "feat: add GitHub Projects V2 integration

- Add GraphQL client for Projects API
- Implement project item synchronization
- Add project field mapping

Closes #123"
```

### 5. プルリクエスト
```bash
# プッシュ
git push origin feature/123-github-projects-integration

# GitHubでプルリクエスト作成
# テンプレートに従って説明を記載
```

## 📝 コーディング規約

### TypeScript規約
```typescript
// ✅ Good
interface PluginConfig {
  enabled: boolean;
  apiKey?: string;
}

class GitHubPlugin implements IPlugin {
  async initialize(context: PluginContext): Promise<void> {
    // 実装
  }
}

// ❌ Bad
class gitHubPlugin {
  initialize(context: any) {
    // any型の使用を避ける
  }
}
```

### ファイル命名規則
```
✅ Good:
  src/plugins/github-plugin.ts
  src/types/plugin-types.ts
  docs/CQM-TEC-001_コアモジュール設計.md

❌ Bad:
  src/plugins/GitHub.ts
  src/types/types.ts
  docs/design.md
```

### コミットメッセージ
```bash
# 形式: <type>(<scope>): <description>

✅ Good:
feat(plugins): add GitHub Projects V2 integration
fix(core): resolve memory leak in plugin loader
docs(api): update MCP tools documentation

❌ Bad:
add feature
fix bug
update docs
```

## 🧪 テスト

### テストの種類
- **ユニットテスト**: 個別の関数・クラス
- **統合テスト**: コンポーネント間の連携
- **E2Eテスト**: 実際のワークフロー

### テスト実行
```bash
# 全テスト実行
npm test

# ユニットテストのみ
npm run test:unit

# 統合テストのみ
npm run test:integration

# カバレッジ付きテスト
npm run test:coverage
```

### テスト記述例
```typescript
// src/core/__tests__/plugin-loader.test.ts
describe('PluginLoader', () => {
  test('should load plugin successfully', async () => {
    const loader = new PluginLoader(config, eventBus, logger);
    await loader.loadPlugin('./test-plugin');
    
    expect(loader.getLoadedPlugins()).toHaveLength(1);
  });
});
```

## 📚 ドキュメント

### 文書の種類
- **技術仕様**: `docs/03_Technical/` 
- **API仕様**: `docs/08_Reference/`
- **ユーザーガイド**: `docs/07_Examples/`

### 文書作成ルール
- [文書管理ガイドライン](docs/12_Policies/CQM-POL-001_文書管理ガイドライン.md) に従う
- 日本語（ユーザー向け）と英語（技術文書）の併記
- Mermaid図表を活用

## 🔍 コードレビュー

### レビュー観点
- **機能性**: 要件を満たしているか
- **品質**: コードが読みやすく保守しやすいか
- **性能**: パフォーマンス要件を満たすか
- **セキュリティ**: セキュリティリスクはないか
- **テスト**: 適切なテストが書かれているか

### レビュー手順
1. CI/CDチェック通過の確認
2. コード差分のレビュー
3. 動作確認（必要に応じて）
4. フィードバック提供
5. 承認・マージ

## 🚀 リリースプロセス

### バージョニング
```bash
# セマンティックバージョニング
MAJOR.MINOR.PATCH

# 例:
v0.1.0  # 初回リリース
v0.1.1  # バグ修正
v0.2.0  # 新機能追加
v1.0.0  # 安定版リリース
```

### リリース手順
1. `main` ブランチで変更をマージ
2. `npm run build` でビルド確認
3. `npm run test` で全テスト通過確認
4. バージョンタグ作成
5. GitHub Releasesでリリースノート公開
6. npm publish（コアチームのみ）

## 🎯 プロジェクト目標

### Phase 0: Ultra-Minimal MVP（2週間）
- [ ] 基本RAGエンジン
- [ ] FileSystemプラグイン
- [ ] Cursor統合

### Phase 1: プラグインシステム（3週間）
- [ ] プラグインフレームワーク
- [ ] GitHubプラグイン
- [ ] 設定管理システム

### Phase 2: エコシステム（4週間）
- [ ] コミュニティプラグイン対応
- [ ] Web UI
- [ ] 高度な統合機能

## 🤝 コミュニティ

### コミュニケーション
- **GitHub Issues**: バグ・機能提案
- **GitHub Discussions**: 質問・アイデア交換
- **Discord**: リアルタイム議論（準備中）

### 行動規範
- 建設的で敬意のあるコミュニケーション
- 多様性とインクルージョンの尊重
- オープンで協力的な態度

## 📞 サポート

質問や問題がある場合：

1. [FAQ](docs/07_Examples/) を確認
2. [GitHub Issues](https://github.com/Shin-R2un/cqm/issues) で検索
3. 新しいIssueを作成
4. [GitHub Discussions](https://github.com/Shin-R2un/cqm/discussions) で質問

---

**あなたのコントリビューションが、CQMをより良いツールにします！**

*"Your contribution makes CQ Models! stronger - Together we connect all AI models!"*