# CQM プロジェクト概要

## プロジェクト名
**CQM** (CQ Models! - Contextual Query Manager)

## 目的
複数のAIモデル（Claude, GPT, Gemini等）に統一的にコンテキストを提供する開発支援システム。アマチュア無線の「CQ（各局呼び出し）」のメタファーを使用し、どのAIツールからでも同じ開発コンテキストにアクセスできることを目指す。

## ミッション
"No matter which AI model you use, get the same context for the best development experience"

## 開発状況
- **現在**: Phase 0（Ultra-Minimal MVP）- 初期開発段階
- **期間**: 2週間での基本機能実装を目標
- **次フェーズ**: プラグインシステム（3週間）、エコシステム構築（4週間）

## アーキテクチャ
- **MCPサーバー**: Model Context Protocol による AI モデル統合
- **RAGエンジン**: Qdrant ベクトルDB + SQLite メタデータ
- **プラグインシステム**: 拡張可能なプラグイン架構
- **monorepo構成**: Turborepo による複数パッケージ管理

## 主要な特徴
1. 統一コンテキスト提供
2. 知識の永続化
3. プライバシー重視（ローカル実行）
4. 拡張可能なプラグインシステム
5. 複数AIモデル対応