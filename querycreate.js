const serverutils = require('./serverutils');

module.exports.createNewUser = function(req){
    let login = req.body.login.toLowerCase();
    let password = serverutils.encrypt(req.body.password);

    let array = makeArray(req.body.avatar, req.body.len);

    return `
    INSERT INTO users (
        login,
        password, 
        name,
        birthDate,
        workPhone,
        privatePhone1,    
        privatePhone2,
        privatePhone3,
        branch,
        position,       
        workPlace,
        about,
        avatar,
        hideYear,
        hidePhones,
        banned
    ) 
    VALUES (
        '${login}',
        '${password}', 
        '${req.body.name}',
        '${req.body.birthDate}',
        '${req.body.workPhone}',
        '${req.body.privatePhone1}',
        '${req.body.privatePhone2}',
        '${req.body.privatePhone3}',
        '${req.body.branch}',
        '${req.body.position}',
        '${req.body.workPlace}',
        '${req.body.about}',
        '${array}',
        '${req.body.hideYear}',
        '${req.body.hidePhones}',
        FALSE);
    `;
};

function makeArray(inp, inpLen){
    let array = '';
    if (inpLen !== 0) {
        array = '{';
        for (let i = 0; i < inpLen; i++) {
            array += (i !== 0 ? ',' : '') + '{' + inp[i] + '}';
        }
        array += '}';
    }
    return array !== '' ? array : '{}';
}

module.exports.updateUserData = function (req, byAdmin = false){
    let array = makeArray(req.body.avatar, req.body.len);
    return `
        UPDATE users SET
            login = '${req.body.login.toLowerCase()}',
            ${req.body.password !== '' ? `password = '${serverutils.encrypt(req.body.password)}',` : ''}
            name = '${req.body.name}',
            birthDate = '${req.body.birthDate}',
            workPhone = '${req.body.workPhone}',
            privatePhone1 = '${req.body.privatePhone1}',
            privatePhone2 = '${req.body.privatePhone2}',
            privatePhone3 = '${req.body.privatePhone3}',
            branch = '${req.body.branch}',
            position = '${req.body.position}', 
            workPlace = '${req.body.workPlace}',
            about = '${req.body.about}',
            ${array !== null ? `avatar = '${array}',` : ''}
            hideYear = '${req.body.hideYear}',
            hidePhones = '${req.body.hidePhones}'
        WHERE id = ${byAdmin ? req.body.id : serverutils.getIdBySession(req.body.session)};
    `;
};

module.exports.selectLastVisited = function(requesting){
    return `
        SELECT lastVisited FROM users
        WHERE id = ${requesting}
    `;
};

module.exports.updateLastVisited = function (lastVisited, requesting){
    return `
        UPDATE users
        SET lastVisited = '{${lastVisited.join(', ')}}'
        WHERE id = ${requesting};
    `;
};

module.exports.usersFilterSelect = function(filter, limit, page, asc, deleted = false){
    return `
        SELECT id, name
        FROM users
        WHERE banned = '${deleted}' AND name LIKE '%${filter}%'
        GROUP BY id
        ORDER BY id ${asc === 'true' ? 'ASC' : 'DESC'}
        LIMIT ${limit} OFFSET ${page * limit};
    `;
};

module.exports.selectCount = function(filter, deleted = false) {
    return `
        SELECT count(*) as usersCount
        FROM users
        WHERE banned = '${deleted}' AND name LIKE '%${filter}%'
    `;
};

module.exports.selectRequestsCount = function(status) {
    return `
        SELECT count(*) as requestsCount
        FROM requests
        ${status !== '' ? `WHERE status = '${status}'` : ''};
    `;
};

module.exports.selectAllBranches = function(asc){
    return `
         SELECT id, branch FROM branches
         ORDER BY branch ${asc === 'true' ? 'ASC' : 'DESC'};
    `;
};

module.exports.selectAllRequests = function(session){
    return `
        SELECT requests.requesting, users.name
            FROM requests
            JOIN users ON users.id = requests.requesting
            WHERE requests.target = ${session} AND requests.status = 0;
        `;
};



function makeDeleteWhereQuery(oldBranches){
    let query = ``;
    if (oldBranches.length !== 0){
        query = `DELETE FROM branches 
            WHERE id NOT IN (`;
        let item = 0;
        for (let branch of oldBranches){
            query += branch[0];
            if (++item !== oldBranches.length){
                query += ', ';
            }
        }
        query += ');'
    }
    return query;
}

function makeUpdateBranchesFromUsersQuery(deleted){
    let query = ``;
    if (deleted.length !== 0){
        query = `UPDATE users
            SET branch = 'None' 
            WHERE branch IN (`;
        let item = 0;
        for (let branch of deleted){
            query += `'` + branch.branch + `'`;
            if (++item !== deleted.length){
                query += ', ';
            }
        }
        query += ');'
    }
    return query;
}

function makeInsertQuery(newBranches){
    let query = ``;
    if (newBranches.length !== 0){
        query = `INSERT INTO branches (branch)
            VALUES `
        ;
        let item = 0;
        for (let branch of newBranches){
            query += `('` + branch[1] + `')`;
            if (++item !== newBranches.length){
                query += ', ';
            }
        }
        query += ';'
    }
    return query;
}

function makeUpdateQuery(oldBranches){
    let query = ``;
    if (oldBranches.length !== 0){
        for (let branch of oldBranches){
            query += `UPDATE branches
                SET branch = '${branch[1]}'
                WHERE id = ${branch[0]};
            `;
        }
    }
    return query;
}

module.exports.makeUpdateBranchesQuery = function(oldBranches, newBranches, deleted){
    return `
        ${makeDeleteWhereQuery(oldBranches)}
        ${makeInsertQuery(newBranches)}
        ${makeUpdateQuery(oldBranches)}
        ${makeUpdateBranchesFromUsersQuery(deleted)}
    `;
};

module.exports.makeSelectWhereQuery = function(oldBranches){
    let query = ``;
    if (oldBranches.length !== 0){
        query = `SELECT branch FROM branches 
            WHERE id NOT IN (`;
        let item = 0;
        for (let branch of oldBranches){
            query += branch[0];
            if (++item !== oldBranches.length){
                query += ', ';
            }
        }
        query += ');'
    }
    return query;
};

module.exports.selectItemsForCarousel = function(lastVisited){
    let idIn = lastVisited.join(', ');
    return `
        SELECT id, name, avatar FROM users
        WHERE id IN (${idIn !== '' ? idIn : '-1'});
    `;
};

module.exports.updateRequests = function(status, target, requesting){
    return `
         UPDATE requests
         SET status = ${status}
         WHERE target = '${target}' AND requesting = '${requesting}';
    `;
};

module.exports.selectId = function(login){
    return `SELECT id, password FROM users
        WHERE login = '${login}' AND banned = FALSE;
    `
};

module.exports.selectAdmin = function(login){
    return `
        SELECT password FROM admins 
        WHERE login = '${login}';
    `
};

module.exports.updateUserBanned = function(deleted, id){
    return `
        UPDATE users
        SET banned = ${deleted}
        WHERE id = ${id};
    `
};

module.exports.selectAllRequestsByAdmin = function(page, limit, status, asc){
    return `
        SELECT * FROM requests
        ${status !== '' ? `WHERE status = ${status}` : ''}
        ORDER BY sendDate ${asc === 'true' ? 'ASC' : 'DESC'}
        LIMIT ${limit} OFFSET ${page * limit};;
    `
};

module.exports.selectIdAndName = function(){
    return `
        SELECT id, name FROM users;
    `
};

module.exports.selectUserInfoById = function(id){
    return `
        SELECT 
            id,
            name, 
            birthDate, 
            workPhone, 
            privatePhone1, 
            privatePhone2, 
            privatePhone3, 
            branch, 
            position, 
            workPlace, 
            about,
            avatar,
            hidePhones,
            hideYear
        FROM users
        WHERE id = ${id};
    `
};

module.exports.selectRequestsStatus = function(id, requesting){
    return `
        SELECT status FROM requests
        WHERE target = '${id}' AND requesting = '${requesting}';
    `
};

module.exports.selectAllInfo = function(id){
    return `
        SELECT *
        FROM users
        WHERE id = ${id};
    `
};

module.exports.selectLogin = function(login){
    return `
        SELECT login FROM users
        WHERE login = '${login}';
    `
};

module.exports.insertNewRequest = function(target, requesting){
    return `
        INSERT INTO requests (target, requesting, status, sendDate)
        VALUES ('${target}', '${requesting}', 0, to_timestamp(${Date.now()} / 1000.0));
    `;
};