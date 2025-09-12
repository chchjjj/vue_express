const express = require('express');
const cors = require('cors');
const path = require('path');
const oracledb = require('oracledb');

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

// 로그인 후 첫(베이직)화면
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


// 서버 시작
app.listen(3009, () => {
  console.log('Server is running on port 3009');
});