![login](https://github.com/chchjjj/vue_express/blob/main/images/login_page.PNG)

## 💡 프로젝트 소개
+ '더조은손해보험'이라는 임의의 보험사의 임직원용 업무관리 사이트입니다.
+ 직원, 고객, 판매 상품, 민원 페이지 등 업무 별로 확인할 수 있도록 화면을 구분하였습니다.
+ 임직원 내에서도 권한(관리자)에 따라 접근할 수 있는 페이지의 차별을 두었습니다.
  

## 📆 개발 기간
+ 2025.09.11 ~ 2025.09.18 (1주간)
  
  + 프로젝트 기획, DB설계, 서비스 개발 및 테스트
    

## 🖥️ 사용 언어
![Oracle](https://img.shields.io/badge/Oracle-F80000?style=for-the-badge&logo=oracle&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![HTML](https://img.shields.io/badge/HTML-000000?style=for-the-badge&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-FEE57B?style=for-the-badge&logoColor=white)


---
## 📝 페이지별 주요 기능
### 1. 로그인 후의 메인페이지 
![main](https://github.com/chchjjj/vue_express/blob/main/images/main_page.PNG)
<img src="https://github.com/chchjjj/vue_express/blob/main/images/info_edit.PNG">
<img src="https://github.com/chchjjj/vue_express/blob/main/images/branch.PNG" width="400" height="400">
<img src="https://github.com/chchjjj/vue_express/blob/main/images/branch_popUp.PNG" width="400" height="400">


+ 왼쪽 상단에 로그인 유저 정보 표시
+ 우측상단 '정보수정' 통해 유저별 개인정보 수정 기능 (로그인 세션 불러오기)
+ 최근 사내 소식 및 업무공지를 미리보기로 확인 및 제목을 통한 상세보기 기능
+ 본부별 합계 매출 실적을 한 눈에 볼 수 있도록 차트화
+ 지점조회 팝업에 지도 연결
---


### 2. 고객조회, 직원조회 페이지
<div align="center">
  <img src="https://github.com/chchjjj/vue_express/blob/main/images/customer.PNG" width="400" height="400"> <img src="https://github.com/chchjjj/vue_express/blob/main/images/customer_edit.PNG" width="400" height="400">
  <img src="https://github.com/chchjjj/vue_express/blob/main/images/employee.PNG" width="400" height="400"> <img src="https://github.com/chchjjj/vue_express/blob/main/images/new_emp.PNG" width="400" height="400">
</div>

+ 로그인 정보 권한에 따라 (관리자, 일반임직원, 설계사) 페이지 접속 제한
+ 고객등록 및 수정은 모두 가능, 새 직원 등록은 관리자만 가능
+ 새 직원등록 시 사번 중복체크 및 사번, 비밀번호는 자리수를 지키도록 설정
+ 권한에 따라 시작되는 사번 번호도 다르게 적용되도록 함

---

### 3. 사내 게시판 및 민원관리 페이지
<div align="center">
  <img src="https://github.com/chchjjj/vue_express/blob/main/images/notice.PNG" width="400" height="400"> <img src="https://github.com/chchjjj/vue_express/blob/main/images/voc_view.PNG" width="400" height="500"> 
  <img src="https://github.com/chchjjj/vue_express/blob/main/images/notice_view.PNG" width="400" height="400"> <img src="https://github.com/chchjjj/vue_express/blob/main/images/voc_add.PNG" width="400" height="400">
</div>

+ 게시판 : 공지사항, 경조사 게시판 구분하여 내용에 맞게 구성
+ 새로운 게시글 등록 및 수정 시 업데이트 된 리스트 불러오기

---

## 🍀 프로젝트 후기
### 😄 좋았던 점
+ 첫 개인프로젝트를 진행하며, CRUD 기반의 웹페이지를 구성함.
+ 실제 근무했던 보험사의 기억을 살려 비슷한 환경 구축을 한 것에 대한 유의미함

### 😥 아쉬운 점
+ 지도 등 다양한 API 활용이 들어갔다면 좀 더 퀄리티 높은 결과를 낼 수 있었을 것
+ 경조사 게시판 댓글 기능, 고객별 상담이력, 계약 수정 등 추가 테이블 통해 좀 더 풍부한 웹페이지를 개발하려 했지만, 기간이 촉박하여 최대한 기본에 충실하게 구현함.

---
## ☑️ 첫 프로젝트를 마치며..
처음부터 끝까지 연계 DB부터 내부 구현 및 CSS까지 혼자 진행해 본 개인 프로젝트였습니다. <BR>
하나하나의 페이지와 함수들이 전체적으로 연계되는 과정에서 그간 학습한 내용을 활용할 수 있어 뿌듯하기도 했지만,<BR>
그보다는 아직까지 설계 등 디테일한 면에서 많이 부족함을 여실히 느낀 기간이었습니다.<BR>
페이지를 구현하며 마주한 수많은 오류들, 막막함, 그러다 사소한 부분이 하나 풀렸을 때의 성취감들이 모여<BR>
조금씩 성장 및 차후 진행할 프로젝트의 기반이 될 수 있을 것이라 생각합니다.




