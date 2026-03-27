# Legacy Content Migration Plan

## 범위
- 1차 이관 대상: `myapp_news`, `myapp_guide`, `myapp_advice`
- 선택 이관 대상: `myapp_newscomment`, `myapp_guidecomment`, `myapp_advicecomment`
- 보류 대상: `myapp_cvemention`, `myapp_contentcve`, `myapp_contentreadhistory`, `myapp_logentry`, `myapp_tool`, `myapp_tech`, 챗봇/메모 설정 테이블

## 이유
- 현재 서비스는 [Post](/c:/project/Codex/Crawler/backend/api/models.py) 중심의 단일 콘텐츠 모델로 재구성되어 있다.
- legacy DB는 콘텐츠 타입별로 테이블이 분리되어 있어 전체를 한 번에 옮기면 매핑 규칙이 과하게 복잡해진다.
- `news + guide + advice`는 스키마가 유사하고 현재 기능과도 직접 연결된다.

## 콘텐츠 매핑
### Legacy -> Current
- `title` -> `Post.title`
- `content` -> `Post.content`
- `link` -> `Post.source_url`
- `normalize(link)` -> `Post.normalized_source_url`
- `site` -> `Post.site`
- `date` -> `Post.published_at`
- `parsed_summary` 또는 `original_summary` -> `Post.summary` (`myapp_news`만)
- legacy 테이블명 -> `Category.name`
  - `myapp_news` -> `news`
  - `myapp_guide` -> `guide`
  - `myapp_advice` -> `advice`

## 상태 매핑
- `needs_review` -> `review`
- `review`, `pending` -> `review`
- `draft`, `temp` -> `draft`
- `published`, `done`, `completed`, `shared` -> `published`
- `archived`, `ignored`, `skip` -> `archived`
- `rejected` -> `rejected`
- 미정/알 수 없는 값 -> `review`

## 사용자 정책
- legacy `auth_user`는 이관하지 않는다.
- 모든 게시글/댓글 작성자는 현재 시스템의 지정 사용자 하나로 통일한다.
- 기본값은 `securnet_admin`이다.

## 댓글 정책
- 댓글은 옵션으로 이관한다.
- 댓글 작성자도 게시글과 동일하게 지정 사용자 하나로 통일한다.
- 댓글 연결은 `legacy_table + legacy_content_id -> new_post_id` 매핑을 기준으로 수행한다.

## 요약 정책
- `myapp_news.parsed_summary`가 있으면 우선 사용한다.
- 없으면 `original_summary`를 JSON으로 파싱해 `title`, `brief`, `summary`를 합친다.
- 둘 다 없으면 `Post.summary`는 비워둔다.

## 보존 파일
- 이관 시 `db/legacy_content_map.csv`를 생성한다.
- 컬럼:
  - `legacy_table`
  - `legacy_id`
  - `new_post_id`
  - `source_url`
  - `status`

## CVE 후속 전략
- `myapp_cvemention`, `myapp_contentcve`는 1차 이관에서 제외한다.
- 대신 `legacy_content_map.csv`를 남겨 두면 나중에 `legacy news id -> new post id` 기준으로 다시 연결할 수 있다.
- 이후 별도 모델 예:
  - `CveMention`
  - `PostCveMention`
  - `CveTrendSnapshot`

## 실행 순서
1. 로컬 MySQL 또는 운영 복제본에 dump를 복원한다.
2. `news + guide + advice`를 먼저 dry-run으로 점검한다.
3. 중복 URL/상태 매핑 결과를 확인한다.
4. 실제 import를 실행한다.
5. 필요하면 댓글을 2차로 이관한다.
6. CVE 기능은 현재 모델 설계 후 별도 이관한다.

## 명령 예시
```bash
python manage.py import_legacy_mysql_content ^
  --host 127.0.0.1 ^
  --port 3306 ^
  --user legacy_user ^
  --password legacy_password ^
  --database news ^
  --author-username securnet_admin ^
  --include-comments
```

## dry-run 예시
```bash
python manage.py import_legacy_mysql_content ^
  --host 127.0.0.1 ^
  --port 3306 ^
  --user legacy_user ^
  --password legacy_password ^
  --database news ^
  --dry-run
```
