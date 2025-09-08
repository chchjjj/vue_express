const oracledb = require('oracledb');

const dbConfig = {
    user: 'system',
    password: 'test1234',
    connectString: 'localhost/xe',
    poolMin: 1,
    poolMax: 5,
    poolIncrement: 1
};

let pool;

async function init() {
    if (!pool) {
        pool = await oracledb.createPool(dbConfig);
        console.log("✅ Oracle connection pool created");
    }
}

function getConnection() {
    if (!pool) {
        throw new Error("Connection pool not initialized. Call init() first.");
    }
    return pool.getConnection();
}

module.exports = {
    init,
    getConnection
};
