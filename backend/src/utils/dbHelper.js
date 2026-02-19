const isPostgres = process.env.NODE_ENV === 'production';

function adaptQuery(query, params = []) {
  if (!isPostgres) {
    return { query, params };
  }

  let counter = 1;
  const adaptedQuery = query.replace(/\?/g, () => `$${counter++}`);
  
  const pgQuery = adaptedQuery
    .replace(/CURDATE\(\)/g, 'CURRENT_DATE')
    .replace(/TIMESTAMPDIFF\(SECOND,/g, 'EXTRACT(EPOCH FROM (')
    .replace(/SEC_TO_TIME\(/g, 'TO_CHAR(INTERVAL \'1 second\' * ')
    .replace(/CONVERT_TZ\(/g, 'TIMEZONE(\'UTC\', ');
  
  return { 
    query: pgQuery, 
    params 
  };
}

async function executeQuery(pool, query, params = []) {
  const { query: adaptedQuery, params: adaptedParams } = adaptQuery(query, params);
  
  if (isPostgres) {
    const result = await pool.query(adaptedQuery, adaptedParams);
    return [result.rows]; 
  } else {
    return await pool.query(adaptedQuery, adaptedParams);
  }
}

function boolValue(val) {
  return isPostgres ? (val ? true : false) : (val ? 1 : 0);
}

module.exports = {
  isPostgres,
  adaptQuery,
  executeQuery,
  boolValue
};
