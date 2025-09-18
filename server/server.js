const express = require('express');
const cors = require('cors');
const path = require('path');
const oracledb = require('oracledb');
const multer = require('multer');

const app = express();
app.use(cors());

// ejs 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '.')); // .은 경로

const config = {
  user: 'SYSTEM',
  password: 'test1234',
  connectString: 'localhost:1521/xe'
};

// Oracle 데이터베이스와 연결을 유지하기 위한 전역 변수
let connection;

// 데이터베이스 연결 설정
async function initializeDatabase() {
  try {
    connection = await oracledb.getConnection(config);
    console.log('Successfully connected to Oracle database');
  } catch (err) {
    console.error('Error connecting to Oracle database', err);
  }
}

initializeDatabase();

// 업로드된 파일의 저장 위치 및 이름 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // 업로드 경로
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// 이미지 업로드 라우터 추가
  app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  res.send({
    message: 'Image uploaded successfully!',
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`
  });
});
// 여기서 upload.single('image')에서 'image'는 
// <input type="file" name="image">의 name 속성과 일치해야 함

// 정적 파일 서빙 설정 (이미지 접근 가능하게)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// 엔드포인트
app.get('/', (req, res) => {
  res.send('Hello World');
});

// EMP 테이블 목록 (리스트 나타내고, 추가로 부서별로 조회)
app.get('/emp/list', async (req, res) => {
  const { deptNo } = req.query;
  let query = "";
  if(deptNo != "" && deptNo != null){ // 빈값도 null도 아닐 때 (빈값이면 전체 다 조회)
    query = `WHERE E.DEPTNO = ${deptNo} ` // 이 조건절 추가 (해당 부서 애들만 조회되게)
  }
  
  try {
    const result = await connection.execute(
      `SELECT * FROM EMP E `
      + `INNER JOIN DEPT D ON E.DEPTNO = D.DEPTNO `
      + query
      + `ORDER BY SAL DESC`
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴 (키-밸류 형태)
    res.json({
        result : "success",
        empList : rows
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 1. 수정버튼 눌렀을 때 일치하는 pk값의 정보 나타내는 것 (부서명, 급여 미포함)
// 2. 리스트에서 사원명 클릭 시 팝업으로 상세정보 띄울 때 ((부서명, 급여 포함, 부서번호 미포함)
app.get('/emp/info', async (req, res) => {
  const { empNo } = req.query;
  try {
    const result = await connection.execute(
      // 보낸 값들에 대해서 각각 별칭 붙이기(별칭 ""로 감싸줘야 대소문자 구분됨)
      `SELECT E.*, DNAME, EMPNO "empNo", ENAME "eName", JOB "job", E.DEPTNO "selectDept" `
      + `FROM EMP E `
      + `INNER JOIN DEPT D ON E.DEPTNO = D.DEPTNO `
      + `WHERE EMPNO = ${empNo}` // 내가 파라미터로 보낸값
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴 (키-밸류 형태)
    res.json({
        result : "success",
        info : rows[0] // 어차피 해당하는 pk값은 하나일테니
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 리스트 맨 오른쪽 삭제 버튼 눌렀을 때
app.get('/emp/delete', async (req, res) => {
  const { empNo } = req.query;

  try {
    await connection.execute(
      // `INSERT INTO STUDENT (STU_NO, STU_NAME, STU_DEPT) VALUES (${stuNo}, '${name}', '${dept}')`,
      `DELETE FROM EMP WHERE EMPNO = :empNo`,
      [empNo],
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// 리스트 맨 왼쪽 선택 체크박스 누른 후 아래 선택삭제 버튼 눌렀을 때
// 핵심) ★ '여러개' 선택하여 삭제할 수 있으므로 이 경우 ★리스트★로 받아야 함.
app.get('/emp/deleteAll', async (req, res) => {
  const { removeList } = req.query;
  // 쿼리 만들기! (중요) / IN 사용
  let query = "DELETE FROM EMP WHERE EMPNO IN (";
  for(let i=0; i<removeList.length; i++){
    query += removeList[i];
    // 마지막 빼고 ',' 추가
    if(removeList.length-1 != i) { // i번째 값이 맨 마지막 값이 아니라면!
      query += ","
    };
  }
  query += ")";
  console.log(query);
  try {
    await connection.execute(
      query,
      [],
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});


app.get('/emp/insert', async (req, res) => {
  const { empNo, eName, job, selectDept } = req.query;

  try {
    await connection.execute(
      // `INSERT INTO STUDENT (STU_NO, STU_NAME, STU_DEPT) VALUES (${stuNo}, '${name}', '${dept}')`,
      `INSERT INTO EMP(EMPNO, ENAME, JOB, DEPTNO) VALUES(:empNo, :eName, :job, :selectDept)`,
      [empNo, eName, job, selectDept], // 윗줄에서 :으로 참조할 값 <- 여기 넣기
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

app.get('/emp/update', async (req, res) => {
  const { empNo, eName, job, selectDept } = req.query;

  try {
    await connection.execute(
      `UPDATE EMP SET `
      + `ENAME = :eName, JOB = :job, DEPTNO = :selectDept `
      + `WHERE EMPNO = :empNo`,
      [eName, job, selectDept, empNo], // 윗줄에서 :으로 접근해서 참조할 값(순서지키기!)
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// 테이블 PROFESSOR 시작
app.get('/prof/list', async (req, res) => {
  const { position } = req.query;
  let query = "";
  if(position != "" && position != null){ // 빈값도 null도 아닐 때 (빈값이면 전체 다 조회)
    query = `WHERE POSITION = '${position}'` // 이 조건절 추가 (해당 부서 애들만 조회되게)
  }
  try {
    const result = await connection.execute(
      `SELECT * FROM PROFESSOR` // 왜 여기선 where절을 안쓸까? => 그냥 전체 리스트 가져오는거라.
      + query
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴
    res.json({
        result : "success",
        profList : rows
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

app.get('/prof/delete', async (req, res) => {
  const { profNo } = req.query;

  try {
    await connection.execute(
      // `INSERT INTO STUDENT (STU_NO, STU_NAME, STU_DEPT) VALUES (${stuNo}, '${name}', '${dept}')`,
      `DELETE FROM PROFESSOR WHERE PROFNO = '${profNo}'`,
      [], // 여길 비우고 위처럼 백틱써도됨 
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing delete', error);
    res.status(500).send('Error executing delete');
  }
});

// 수정버튼 눌렀을 때 일치하는 pk값의 정보 나타내는 것
app.get('/prof/info', async (req, res) => {
  const { profNo } = req.query;
  try {
    const result = await connection.execute(
      `SELECT P.*, PROFNO "profNo", NAME "name", ID "id", POSITION "position", PAY "pay" `
      + `FROM PROFESSOR P `
      + `WHERE PROFNO = ${profNo}` // 내가 파라미터로 보낸값
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴
    res.json({
        result : "success",
        info : rows[0] // 어차피 해당하는 pk값은 하나일테니
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

app.get('/prof/update', async (req, res) => {
  const { profNo, name, id, position, pay } = req.query;

  try {
    await connection.execute(
      `UPDATE PROFESSOR SET `
      + `NAME = :name, ID = :id, POSITION = :position, PAY = :pay `
      + `WHERE PROFNO = :profNo`,
      [name, id, position, pay, profNo], // 윗줄에서 :으로 접근해서 참조할 값(순서지키기!)
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});


app.get('/board/list', async (req, res) => {
  const { pageSize, offset } = req.query;
  
  try {
    const result = await connection.execute(
      `SELECT B.*, TO_CHAR(CDATETIME, 'YYYY-MM-DD') AS CDATE FROM TBL_BOARD B `
      +`OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY` // 몇페이지씩 건너뛸건지
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });

    const count = await connection.execute(
      `SELECT COUNT(*) FROM TBL_BOARD`
    );

    // 리턴
    res.json({
        result : "success",
        boardList : rows,
        count : count.rows[0][0] // 게시글 개수 구하려고 이 내용 추가함
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});


app.get('/board/add', async (req, res) => {
  const { kind, title, contents, userId } = req.query;

  try {
    await connection.execute(
      // 모든 컬럼 쓸거라서 테이블명 뒤에 (컬럼명) 이렇게 넣는건 생략
      `INSERT INTO TBL_BOARD VALUES(B_SEQ.NEXTVAL, :title, :contents, :userId, '0', '0', :kind, SYSDATE, SYSDATE)`,
      [title, contents, userId, kind], // 윗줄에서 :으로 참조할 값 <- 여기 넣기
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});


app.get('/board/info', async (req, res) => {
  const { boardNo } = req.query;
  try {
    const result = await connection.execute(
      `SELECT * FROM TBL_BOARD WHERE BOARDNO = ${boardNo}` // 내가 파라미터로 보낸값
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴 (키-밸류 형태)
    res.json({
        result : "success",
        info : rows[0] // 어차피 해당하는 pk값은 하나일테니
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// ================================================================================
// ★★ 프로젝트 내용 ★★

// 로그인 
app.get('/pro-login', async (req, res) => {
  const { empNo, pwd } = req.query;
  // 아디 & 비번 둘다 일치해야하니까 where 조건문 and로 연결, 문자열이니까 ''로 묶어주기
  let query = `SELECT * FROM EMPLOYEE WHERE EMPNO = '${empNo}' AND PASSWORD = '${pwd}'`;
  try {
    const result = await connection.execute(query);
    const columnNames = result.metaData.map(column => column.name);

    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    res.json(rows); // 여기 rows 값이 존재하면, 조건 만족하는 내용이 있다는 뜻 (로그인 가능)
    // 빈값이라면 정보가 없으니 아디 비번 재확인하라고 안내해주면 되는거
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 로그인 후 첫(베이직)화면 (1)
app.get('/pro-basic', async (req, res) => {
  const { empNo } = req.query;
  try {
    const result = await connection.execute(
      `SELECT * FROM EMPLOYEE WHERE EMPNO = ${empNo}`
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴
    res.json({
        result : "success",
        empList : rows
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 로그인 후 첫(베이직)화면 (2) - 공지사항 게시판 미리보기
app.get('/notice/preview', async (req, res) => {
  const { } = req.query;
  try {
    const result = await connection.execute(
      `SELECT TYPE, TITLE, WRITER, TO_CHAR(CDATE, 'YYYY-MM-DD') AS CDATE `
      + `FROM NOTICE `
      + `ORDER BY CDATE DESC `
      + `FETCH FIRST 3 ROWS ONLY`
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴
    res.json({
        result : "success",
        preList : rows
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 로그인 후 첫(베이직)화면 (3) - 경조사 게시판 미리보기
app.get('/event/preview', async (req, res) => {
  const { } = req.query;
  try {
    const result = await connection.execute(
      `SELECT TYPE, TITLE, WRITER, TO_CHAR(CDATE, 'YYYY-MM-DD') AS CDATE `
      + `FROM EVENT `
      + `ORDER BY CDATE DESC `
      + `FETCH FIRST 3 ROWS ONLY`
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴
    res.json({
        result : "success",
        eventList : rows
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 공지사항 게시판 (더보기 눌러서 접속)
app.get('/notice', async (req, res) => {
  const { } = req.query;
  try {
    const result = await connection.execute(
      `SELECT BOARDNO, TYPE, TITLE, WRITER, TO_CHAR(CDATE, 'YYYY-MM-DD') AS CDATE `
      + `FROM NOTICE `
      + `ORDER BY BOARDNO DESC`
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴
    res.json({
        result : "success",
        notiList : rows
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 공지사항 새 글 쓰기 (인서트)
app.get('/notice/insert', async (req, res) => {
  const { type, title, contents, writer } = req.query;

  try {
    await connection.execute(
      `INSERT INTO NOTICE(BOARDNO, TYPE, TITLE, CONTENTS, WRITER, CDATE) `
      +`VALUES(SEQ_NOTICE.NEXTVAL, :type, :title, :contents, :writer, SYSDATE)`,
      [type, title, contents, writer], // 윗줄에서 :으로 참조할 값 <- 여기 넣기
      { autoCommit: true }   
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// 공지사항 상세
app.get('/notice/info', async (req, res) => {
  const { boardNo } = req.query;
  try {
    const result = await connection.execute(
      `SELECT BOARDNO, TYPE, TITLE, WRITER, `
      + `TO_CHAR(CDATE, 'YYYY-MM-DD') AS CDATE, `
      + `DBMS_LOB.SUBSTR(CONTENTS, 4000, 1) AS CONTENTS, `
      + `E.EMPNO AS WRITER_EMPNO `
      + `FROM NOTICE N `
      + `INNER JOIN EMPLOYEE E ON N.WRITER = E.ENAME `
      + `WHERE BOARDNO = ${boardNo}` // 내가 파라미터로 보낸값
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴 (키-밸류 형태)
    res.json({
        result : "success",
        info : rows[0] // 어차피 해당하는 pk값은 하나일테니
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 공지 수정
app.get('/notice/update', async (req, res) => {
  const { type, title, contents, boardNo } = req.query;

  try {
    await connection.execute(
      `UPDATE NOTICE SET `
      + `TYPE = :type, TITLE = :title, CONTENTS = :contents `
      + `WHERE BOARDNO = :boardNo`,
      [type, title, contents, boardNo ], // 윗줄에서 :으로 접근해서 참조할 값(순서지키기!)
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// 공지 삭제
app.get('/notice/delete', async (req, res) => {
  const { boardNo } = req.query;

  try {
    await connection.execute(      
      `DELETE FROM NOTICE WHERE BOARDNO = '${boardNo}'`,
      [], // 여길 비우고 위처럼 백틱써도됨 
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing delete', error);
    res.status(500).send('Error executing delete');
  }
});

// 경조사 게시판 (더보기 눌러서 접속)
app.get('/event', async (req, res) => {
  const { } = req.query;
  try {
    const result = await connection.execute(
      `SELECT BOARDNO, TYPE, TITLE, WRITER, TO_CHAR(CDATE, 'YYYY-MM-DD') AS CDATE `
      + `FROM EVENT `
      + `ORDER BY BOARDNO DESC`
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴
    res.json({
        result : "success",
        list : rows
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 경조사 게시글 상세
app.get('/event/info', async (req, res) => {
  const { boardNo } = req.query;
  try {
    const result = await connection.execute(
      `SELECT BOARDNO, TYPE, TITLE, WRITER, `
      + `TO_CHAR(CDATE, 'YYYY-MM-DD') AS CDATE, `
      + `DBMS_LOB.SUBSTR(CONTENTS, 4000, 1) AS CONTENTS, `
      + `E.EMPNO AS WRITER_EMPNO `
      + `FROM EVENT V `
      + `LEFT JOIN EMPLOYEE E ON V.WRITER = E.ENAME `
      + `WHERE BOARDNO = ${boardNo}` // 내가 파라미터로 보낸값
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴 (키-밸류 형태)
    res.json({
        result : "success",
        info : rows[0] // 어차피 해당하는 pk값은 하나일테니
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 경조사 수정
app.get('/event/update', async (req, res) => {
  const { type, title, contents, boardNo } = req.query;

  try {
    await connection.execute(
      `UPDATE EVENT SET `
      + `TYPE = :type, TITLE = :title, CONTENTS = :contents `
      + `WHERE BOARDNO = :boardNo`,
      [type, title, contents, boardNo ], // 윗줄에서 :으로 접근해서 참조할 값(순서지키기!)
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// 경조사 게시글 삭제
app.get('/event/delete', async (req, res) => {
  const { boardNo } = req.query;

  try {
    await connection.execute(      
      `DELETE FROM EVENT WHERE BOARDNO = '${boardNo}'`,
      [], // 여길 비우고 위처럼 백틱써도됨 
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing delete', error);
    res.status(500).send('Error executing delete');
  }
});

// 경조사 새 글 쓰기 (인서트)
app.get('/event/insert', async (req, res) => {
  const { type, title, contents, writer } = req.query;

  try {
    await connection.execute(
      `INSERT INTO EVENT(BOARDNO, TYPE, TITLE, CONTENTS, WRITER, CDATE) `
      +`VALUES(SEQ_EVENT.NEXTVAL, :type, :title, :contents, :writer, SYSDATE)`,
      [type, title, contents, writer], // 윗줄에서 :으로 참조할 값 <- 여기 넣기
      { autoCommit: true }   
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// 고객조회화면
app.get('/cusList', async (req, res) => {
  const { offset, pageSize, option, keyword} = req.query;
  
  // 검색관련
  let subQuery = "";
  if(option == "all"){
    subQuery = `WHERE CUSNAME LIKE '%${keyword}%' OR PHONE LIKE '%${keyword}%'`;
  } else if(option == "cusname"){
    subQuery = `WHERE CUSNAME LIKE '%${keyword}%'`;
  } else if(option == "phone"){ 
    subQuery = `WHERE PHONE LIKE '%${keyword}%'`;
  } // 나중에 다른 옵션이 생길 수 있으니 그냥 else는 x

  try {
    const result = await connection.execute(
      `SELECT C.*, TO_CHAR(BIRTH, 'YYYY-MM-DD') AS BIR FROM CUSTOMERS C `
     + `${subQuery} `
     +`OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY` // 몇페이지씩 건너뛸건지
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });

    const count = await connection.execute(
      `SELECT COUNT(*) FROM CUSTOMERS`
    );

    // 리턴
    res.json({
        result : "success",
        cusList : rows,
        count : count.rows[0][0] // 게시글 개수 구하려고 이 내용 추가함
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 고객 상세조회
app.get('/cus/info', async (req, res) => {
  const { cusNo } = req.query;
  try {
    const result = await connection.execute(
      // 보낸 값들에 대해서 각각 별칭 붙이기(별칭 ""로 감싸줘야 대소문자 구분됨)
      `SELECT C.*, P_NAME, CUSNO "cusNo", CUSNAME "cName", `
      + `TO_CHAR(BIRTH, 'YYYY-MM-DD') AS BIR, GENDER "gender", PHONE "phone", `
      + `ADDRESS "addr", TO_CHAR(SIGN_DATE, 'YYYY-MM-DD') AS SIGNDATE `
      + `FROM CUSTOMERS C `
      + `LEFT JOIN PRODUCTS P ON P.P_NO = C.PROD_NO `
      + `WHERE CUSNO = ${cusNo}` // 내가 파라미터로 보낸값
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴 (키-밸류 형태)
    res.json({
        result : "success",
        info : rows[0] // 어차피 해당하는 pk값은 하나일테니
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});


// 개인정보 수정 팝업에서 최종 수정 버튼 눌렀을 때
app.get('/pro-info-update', async (req, res) => {
  const { empNo, newPwd, midPhone, lastPhone } = req.query;

  try {
    await connection.execute(
    `UPDATE EMPLOYEE SET PASSWORD = :newPwd, MOBILE = :mobile WHERE EMPNO = :empNo`,
      {
        newPwd: newPwd,
        mobile: `010-${midPhone}-${lastPhone}`,
        empNo: empNo
      },
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// 고객 정보 수정
app.get('/cus/update', async (req, res) => {
  const { cusNo, cName, BIR, gender, phone, addr } = req.query;

  try {
    await connection.execute(
      `UPDATE CUSTOMERS SET `
      + `CUSNAME = :cName, BIRTH = :BIR, GENDER = :gender, PHONE = :phone, ADDRESS = :addr `
      + `WHERE CUSNO = :cusNo`,
      [cName, BIR, gender, phone, addr, cusNo], // 윗줄에서 :으로 접근해서 참조할 값(순서지키기!)
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// 고객정보 삭제
app.get('/cus/delete', async (req, res) => {
  const { cusNo } = req.query;

  try {
    await connection.execute(      
      `DELETE FROM CUSTOMERS WHERE CUSNO = '${cusNo}'`,
      [], // 여길 비우고 위처럼 백틱써도됨 
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing delete', error);
    res.status(500).send('Error executing delete');
  }
});

// 새 고객 등록 시 기존등록 여부 확인
app.get('/cusChk', async (req, res) => {
  const { cusName, birth } = req.query;
  try {
    const result = await connection.execute(
      `SELECT * FROM CUSTOMERS WHERE CUSNAME = '${cusName}' AND BIRTH = '${birth}'`
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴
    res.json({
        result : "success",
        cusList : rows
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 새 고객 등록(인서트)
app.get('/cus/insert', async (req, res) => {
  const { cusName, birth, gender, phone, addr, signDate, charge } = req.query;

  try {
    await connection.execute(
      `INSERT INTO CUSTOMERS (CUSNO, CUSNAME, BIRTH, GENDER, PHONE, ADDRESS, SIGN_DATE, CHARGE) `
      +`VALUES(CUSNO_SEQ.NEXTVAL, :cusName, :birth, :gender, :phone, :addr, :signDate, :charge)`,
      [cusName, birth, gender, phone, addr, signDate, charge], // 윗줄에서 :으로 참조할 값 <- 여기 넣기
      { autoCommit: true }   
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// 직원조회(리스트)
app.get('/pro-emp/list', async (req, res) => {
  const { offset, pageSize, option, keyword} = req.query;
  
  // 검색관련
  let subQuery = "";
  if(option == "all"){
    subQuery = `WHERE ENAME LIKE '%${keyword}%' OR PH LIKE '%${keyword}%'`;
  } else if(option == "ename"){
    subQuery = `WHERE ENAME LIKE '%${keyword}%'`;
  } else if(option == "phone"){ 
    subQuery = `WHERE PH LIKE '%${keyword}%'`;
  } // 나중에 다른 옵션이 생길 수 있으니 그냥 else는 x

  try {
    const result = await connection.execute(
      `SELECT E.*, TO_CHAR(REG_DATE, 'YYYY-MM-DD') AS REG FROM EMPLOYEE E `
     + `${subQuery} `
     +`OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY` // 몇페이지씩 건너뛸건지
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });

    const count = await connection.execute(
      `SELECT COUNT(*) FROM EMPLOYEE`
    );

    // 리턴
    res.json({
        result : "success",
        proEmpList : rows,
        count : count.rows[0][0] // 게시글 개수 구하려고 이 내용 추가함
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 새 직원 등록 시 사원번호 중복체크
app.get('/empNochk', async (req, res) => {
  const { empNo } = req.query;
  let query = `SELECT * FROM EMPLOYEE WHERE EMPNO = '${empNo}'`;
  try {
    const result = await connection.execute(query);
    const columnNames = result.metaData.map(column => column.name);

    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    res.json({
      result : "success", // 찾았으면 중복이 됐다는거
      list : rows
    }); 
    
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});


// 새 직원 등록 (인서트)
app.get('/pro-emp/insert', async (req, res) => {
  const { eName, empNo, pwd, dept, position, ph, mobile, status, regDate } = req.query;

  try {
    await connection.execute(
      `INSERT INTO EMPLOYEE (ENAME, EMPNO, PASSWORD, DEPT, POSITION, PH, MOBILE, STATUS, REG_DATE) `
      +`VALUES(:eName, :empNo, :pwd, :dept, :position, :ph, :mobile, :status, :regDate)`,
      [eName, empNo, pwd, dept, position, ph, mobile, status, regDate], // 윗줄에서 :으로 참조할 값 <- 여기 넣기
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// 직원 정보 수정 (기존정보 끌고오기)
app.get('/pro-emp/info', async (req, res) => {
  const { empNo } = req.query;
  try {
    const result = await connection.execute(
      // 보낸 값들에 대해서 각각 별칭 붙이기(별칭 ""로 감싸줘야 대소문자 구분됨)
      `SELECT E.*, EMPNO "empNo", ENAME "eName", `
      + `DEPT "dept", POSITION "position", PH "ph", STATUS "status", TO_CHAR(REG_DATE, 'YYYY-MM-DD') AS REG  `
      + `FROM EMPLOYEE E `
      + `WHERE EMPNO = ${empNo}` // 내가 파라미터로 보낸값
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴 (키-밸류 형태)
    res.json({
        result : "success",
        info : rows[0] // 어차피 해당하는 pk값은 하나일테니
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 상품조회
app.get('/prod/list', async (req, res) => {
  const {  } = req.query;  
  try {
    const result = await connection.execute(
      `SELECT P.*, TO_CHAR(R_DATE, 'YYYY-MM-DD') AS RDATE FROM PRODUCTS P`
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴 (키-밸류 형태)
    res.json({
        result : "success",
        prodList : rows
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 새 상품 등록 시 기존등록 여부 확인
app.get('/prodChk', async (req, res) => {
  const {pNo} = req.query;
  try {
    const result = await connection.execute(
      `SELECT * FROM PRODUCTS WHERE P_NO = '${pNo}'`
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴
    res.json({
        result : "success",
        list : rows
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 새 상품 등록(인서트)
app.get('/prod/insert', async (req, res) => {
  const { pNo, type, pName, rDate, price, refund, poster } = req.query;

  try {
    await connection.execute(
      `INSERT INTO PRODUCTS (P_NO, TYPE, P_NAME, R_DATE, PRICE, REFUND, POSTER) `
      +`VALUES(:pNo, :type, :pName, :rDate, :price, :refund, :poster)`,
      [pNo, type, pName, rDate, price, refund, poster], // 윗줄에서 :으로 참조할 값 <- 여기 넣기
      { autoCommit: true }   
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// 계약관리(계약조회) 리스트
app.get('/contract/list', async (req, res) => {
  const { offset, pageSize, option, keyword} = req.query;
  
  // 검색관련
  let subQuery = "";
  if(option == "all"){
    subQuery = `WHERE CNAME LIKE '%${keyword}%' OR BL_NO LIKE '%${keyword}%'`;
  } else if(option == "cname"){
    subQuery = `WHERE CNAME LIKE '%${keyword}%'`;
  } else if(option == "bl"){ 
    subQuery = `WHERE BL_NO LIKE '%${keyword}%'`;
  } // 나중에 다른 옵션이 생길 수 있으니 그냥 else는 x

  try {
    const result = await connection.execute(
      `SELECT BL_NO, CNAME, PNAME, FEE, TO_CHAR(SDATE, 'YYYY-MM-DD') AS SDATE, CHARGE FROM CONTRACT C `
     + `${subQuery} `
     +`OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY` // 몇페이지씩 건너뛸건지
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });

    const count = await connection.execute(
      `SELECT COUNT(*) FROM CONTRACT`
    );

    // 리턴
    res.json({
        result : "success",
        list : rows,
        count : count.rows[0][0] // 게시글 개수 구하려고 이 내용 추가함
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// 계약 상세조회
app.get('/contract/info', async (req, res) => {
  const { blNo } = req.query;
  try {
    const result = await connection.execute(
      `SELECT C.*, TO_CHAR(SDATE, 'YYYY-MM-DD') AS S_DATE FROM CONTRACT C WHERE BL_NO = '${blNo}'` // 내가 파라미터로 보낸값
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴 (키-밸류 형태)
    res.json({
        result : "success",
        info : rows[0] // 어차피 해당하는 pk값은 하나일테니
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// VOC 모니터링 리스트(기본화면)
app.get('/voc/list', async (req, res) => {
  const {  } = req.query;  
  try {
    const result = await connection.execute(
      `SELECT VOC_NO, TYPE, VNAME, TITLE, TO_CHAR(CDATE, 'YYYY-MM-DD') AS CDATE, CHARGE `
    + `FROM VOC `
    + `ORDER BY VOC_NO DESC` 
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });
      return obj;
    });
    // 리턴 (키-밸류 형태)
    res.json({
        result : "success",
        list : rows
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// VOC 내용 상세보기
app.get('/voc/info', async (req, res) => {
  const { vocNo } = req.query;
  try {
    const result = await connection.execute(
      // 보낸 값들에 대해서 각각 별칭 붙이기(별칭 ""로 감싸줘야 대소문자 구분됨)
      `SELECT VOC_NO, TYPE, TITLE, VNAME, TO_CHAR(CDATE, 'YYYY-MM-DD') AS CDATE, `
      + `TO_CHAR(CONTENTS) AS CONTENTS, CHARGE, COMMENTS, CLEAR, `
      + `E.EMPNO AS CHARGE_EMPNO `
      + `FROM VOC V `
      + `LEFT JOIN EMPLOYEE E ON V.CHARGE = E.ENAME `
      + `WHERE VOC_NO = ${vocNo}` // 내가 파라미터로 보낸값
    );
    const columnNames = result.metaData.map(column => column.name);
    // 쿼리 결과를 JSON 형태로 변환
    const rows = result.rows.map(row => {
      // 각 행의 데이터를 컬럼명에 맞게 매핑하여 JSON 객체로 변환
      const obj = {};
      columnNames.forEach((columnName, index) => {
        obj[columnName] = row[index];
      });

      return obj;
    });
    // 리턴 (키-밸류 형태)
    res.json({
        result : "success",
        info : rows[0] // 어차피 해당하는 pk값은 하나일테니
    });
  } catch (error) {
    console.error('Error executing query', error);
    res.status(500).send('Error executing query');
  }
});

// VOC 내용 수정 (예상민원, 금감원 동일)
app.get('/voc/update', async (req, res) => {
  const { clear, vocNo } = req.query;

  try {
    await connection.execute(
      `UPDATE VOC SET `
      + `CLEAR = :clear `
      + `WHERE VOC_NO = :vocNo`,
      [clear, vocNo ], // 윗줄에서 :으로 접근해서 참조할 값(순서지키기!)
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});


// VOC 예상민원 새 글 쓰기 (인서트)
app.get('/voc/ex/insert', async (req, res) => {
  const { type, vName, title, contents, charge, comments, clear } = req.query;

  try {
    await connection.execute(
      `INSERT INTO VOC(VOC_NO, TYPE, VNAME, CDATE, TITLE, CONTENTS, CHARGE, COMMENTS, CLEAR) `
      +`VALUES(VOC_SEQ.NEXTVAL, :type, :vName, SYSDATE, :title, :contents, :charge, :comments, :clear)`,
      [type, vName, title, contents, charge, comments, clear], // 윗줄에서 :으로 참조할 값 <- 여기 넣기
      { autoCommit: true }   
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// VOC 금감원 새 글 쓰기 (인서트)
app.get('/voc/fss/insert', async (req, res) => {
  const { type, vName, title, contents, charge, comments, clear } = req.query;

  try {
    await connection.execute(
      `INSERT INTO VOC(VOC_NO, TYPE, VNAME, CDATE, TITLE, CONTENTS, CHARGE, COMMENTS, CLEAR) `
      +`VALUES(VOC_SEQ.NEXTVAL, :type, :vName, SYSDATE, :title, :contents, :charge, :comments, :clear)`,
      [type, vName, title, contents, charge, comments, clear], // 윗줄에서 :으로 참조할 값 <- 여기 넣기
      { autoCommit: true }   
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing insert', error);
    res.status(500).send('Error executing insert');
  }
});

// 계약 차트 
app.get('/contract/chart', async (req, res) => {
  try {
    const result = await connection.execute(
      `SELECT BRANCH, SUM(FEE) AS TOTAL_FEE `
    + `FROM CONTRACT `
    + `GROUP BY BRANCH `
    + `ORDER BY TOTAL_FEE DESC`
    );

    const columnNames = result.metaData.map(column => column.name);
    const rows = result.rows.map(row => {
      const obj = {};
      columnNames.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });

    res.json({
      result: "success",
      chartData: rows
    });
  } catch (error) {
    console.error('Error executing chart query', error);
    res.status(500).send('Error executing chart query');
  }
});



// 서버 시작
app.listen(3009, () => {
  console.log('Server is running on port 3009');
});