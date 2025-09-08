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

app.get('/emp/list', async (req, res) => {
  const { } = req.query;
  try {
    const result = await connection.execute(
      `SELECT * FROM EMP E `
      + `INNER JOIN DEPT D ON E.DEPTNO = D.DEPTNO `
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


// 수정버튼 눌렀을 때 일치하는 pk값의 정보 나타내는 것
app.get('/emp/info', async (req, res) => {
  const {empNo} = req.query;
  try {
    const result = await connection.execute(
      // 보낸 값들에 대해서 각각 별칭 붙이기(별칭 ""로 감싸줘야 대소문자 구분됨)
      `SELECT E.*, EMPNO "empNo", ENAME "eName", JOB "job", DEPTNO "selectDept" `
      + `FROM EMP E `
      + `WHERE EMPNO = ${empNo}`   // 내가 파라미터로 보낸값
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


app.get('/emp/delete', async (req, res) => {
  const { empNo } = req.query;

  try {
    await connection.execute(
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

app.get('/emp/insert', async (req, res) => {
  const { empNo, eName, job, selectDept } = req.query;

  try {
    await connection.execute(
      `INSERT INTO EMP(EMPNO, ENAME, JOB, DEPTNO) VALUES (:empNo, :eName, :job, :selectDept) `,
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

app.get('/prof/list', async (req, res) => {
  const {} = req.query;
  try {
    const result = await connection.execute(
      `SELECT * FROM PROFESSOR`   // 왜 여기선 where절을 안쓸까? => 그냥 전체 리스트 가져오는거라.
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
      `DELETE FROM PROFESSOR WHERE PROFNO = '${profNo}'`,
      [], // 여길 비우고 백틱써도됨 
      { autoCommit: true }
    );
    res.json({
        result : "success"
    });
  } catch (error) {
    console.error('Error executing delete', error);
    res.status(500).send('Error executing insert');
  }
});


// 서버 시작
app.listen(3009, () => {
  console.log('Server is running on port 3009');
});
