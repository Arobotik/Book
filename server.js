const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = process.env.PORT || 5000;

const pg = require('pg');

const config = {
    host: 'localhost',
    user: 'postgres',
    password: 'password',
    database: 'postgres',
    port: 5432,
    ssl: false
};

const client = new pg.Client(config);

client.connect(err => {
    if (err) throw err;
    else {
        queryDatabase();
    }
});

function queryDatabase(){
    let query = `
        CREATE TABLE IF NOT EXISTS users (
            id serial PRIMARY KEY,
            login VARCHAR(25),
            password VARCHAR(16), 
            name VARCHAR(60),
            birthDate DATE,
            workPhone VARCHAR(17),
            privatePhone1 VARCHAR(17),   
            privatePhone2 VARCHAR(17),   
            privatePhone3 VARCHAR(17),   
            branch VARCHAR(20),   
            position VARCHAR(20),          
            workPlace VARCHAR(20),   
            about VARCHAR(100),  
            avatar SMALLINT ARRAY, 
            lastVisited INTEGER ARRAY,
            hideYear BOOLEAN,
            hidePhones BOOLEAN,
            banned BOOLEAN
        );
        
        CREATE TABLE IF NOT EXISTS requests (
            id serial PRIMARY KEY,
            target INTEGER,
            requesting INTEGER,
            sendDate DATE,
            status INT
        );
        
        CREATE TABLE IF NOT EXISTS branches(
            id serial PRIMARY KEY,
            branch VARCHAR(40)
        );

        DROP TABLE IF EXISTS admins;
        CREATE TABLE IF NOT EXISTS admins (
            login VARCHAR(20) PRIMARY KEY,
            password VARCHAR(20)
        );    
        
        INSERT INTO admins (login, password) 
            VALUES ('admin', 'admin'),
                   ('DSR', 'DSR');
            
        ALTER TABLE users
            OWNER to postgres;
        ALTER TABLE admins
            OWNER to postgres;
        ALTER TABLE requests
            OWNER to postgres;
    `;
    client
        .query(query);
}

function makeArray(inp, inpLen){
    let array = '';
    if (inpLen !== 0) {
        array = '{';
        for (let i = 0; i < inpLen; i++) {
            array += (i !== 0 ? ',' : '') + '{' + inp[i] + '}';
        }
        array += '}';
    }
    return array;
}

function addInLastVisited(id, lastVisited){
    if (lastVisited === null)
        lastVisited = [];
    let ind = lastVisited.findIndex(item => item === id);
    if (ind !== -1){
        lastVisited.unshift(lastVisited[ind]);
        lastVisited.splice(ind + 1, 1);
    }
    else{
        lastVisited.unshift(id);
    }
    lastVisited.length = lastVisited.length > 9 ? 9 : lastVisited.length;
    return lastVisited;
}

function createNewUser(req){
    let login = req.body.login.toLowerCase();
    let password = req.body.password;

    let array = makeArray(req.body.avatar, req.body.len);

    let query = `
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
    client
        .query(query);
}

function updateUserData(req){
    let login = req.body.login.toLowerCase();
    let password = req.body.password;

    let array = makeArray(req.body.avatar, req.body.len);

    let query = `
        UPDATE users SET
            login = '${login}',
            password = '${password}',
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
            avatar = '${array}',
            hideYear = '${req.body.hideYear}',
            hidePhones = '${req.body.hidePhones}'
        WHERE login = '${req.body.oldLogin.toLowerCase()}' AND password = '${req.body.oldPassword}';
    `;
    client
        .query(query);
}

function findNameById(ids, toFind){
    for (let user of ids){
        if (user.id === Number(toFind)){
            return [user.id, user.name];
        }
    }
}

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// API calls
app.get('/loginGet', (req, res) => {
    res.send({ express: 'Please, login:' });
});

let toSend = null;
let anotherUserToSend = null;

let limit = 2;

app.post('/bookAllGet', (req, res) => {
    let query = `
        SELECT id, name
        FROM users
        WHERE banned = FALSE AND name LIKE '%${req.body.filter}%'
        GROUP BY id
        ORDER BY id
        LIMIT ${limit} OFFSET ${req.body.page * limit}
    `;


    client
        .query(query)
        .then(result => {
            query = `
                SELECT count(*) as usersCount
                FROM users
                WHERE banned = FALSE AND name LIKE '%${req.body.filter}%'
            `;
            client
                .query(query)
                .then(count => {
                    let usersToSend = [];
                    for (let row of result.rows) {
                        usersToSend.push([row.id, row.name]);
                    }
                    res.send({
                        express: usersToSend,
                        pageCount: Math.ceil(count.rows[0].userscount / limit)
                    });
                });
        });

    toSend = null;
    anotherUserToSend = null;
});

app.get('/getAllBranches', (req, res) => {
    let query = `
         SELECT id, branch FROM branches;
    `;
    client.query(query)
        .then(result => {
            let branchesToSend = [];
            for (let row of result.rows){
                let branch = [row.id, row.branch];
                branchesToSend.push(branch);
            }
            res.send({express: branchesToSend});
        });
});

app.post('/requestsAllGet', (req, res) => {
    let query = `
        SELECT id FROM users
        WHERE login = '${req.body.login}'
    `;

    let requestsToSend = [];
    client
        .query(query)
        .then(result => {
            query = `
                SELECT requests.requesting, users.name
                FROM requests
                JOIN users ON users.id = requests.requesting
                WHERE requests.target = ${result.rows[0].id} AND requests.status = 0;
            `;
            client
                .query(query)
                .then(result => {
                    for (let row of result.rows) {
                        requestsToSend.push([row.requesting, row.name]);
                    }
                    res.send({express: requestsToSend});
                })
        });


    toSend = null;
    anotherUserToSend = null;
});

app.post('/bookAllGetByAdmin', (req, res) => {
    let query = `
        SELECT login FROM admins WHERE login = '${req.body.login}' AND password = '${req.body.password}';
    `;

    client
        .query(query)
        .then(result => {
            if (result.rows[0] !== undefined) {
                query = `
                    SELECT login, name 
                    FROM users
                    WHERE banned = '${req.body.deleted}'
                `;

                client
                    .query(query)
                    .then(result => {
                        let usersToSend = [];
                        for (let row of result.rows) {
                            usersToSend.push([row.login, row.name]);
                        }
                        res.send({express: usersToSend});
                    });


                toSend = null;
                anotherUserToSend = null;
            }
            else{
                res.send({express: false});
            }
        });
});

app.post('/getLastVisited', (req, res) => {
    let query = `
        SELECT lastvisited FROM users
        WHERE login = '${req.body.login.toLowerCase()}' AND password = '${req.body.password}';
    `;

    client
        .query(query)
        .then(result => {
            if (result.rows[0].lastvisited !== null){
                query = `
                    SELECT id, name, avatar FROM users
                    WHERE id IN (${result.rows[0].lastvisited.join(', ')});
                `;
                client
                    .query(query)
                    .then(result => {
                        let lastVisitedToSend = [];
                        for (let row of result.rows){
                            let lastVisited = [row.id, row.name, row.avatar];
                            lastVisitedToSend.push(lastVisited);
                        }
                        res.send({express: lastVisitedToSend});
                    });
            }
            else(res.send({express: []}));
        });
});

function onAddInLastVisited(id, requesting){
    let query = `
        SELECT lastVisited FROM users
        WHERE id = ${requesting}
    `;
    client
        .query(query)
        .then(result => {
            let lastVisited = addInLastVisited(id, result.rows[0] !== undefined ? result.rows[0].lastvisited : []);
            query = `
                UPDATE users
                SET lastVisited = '{${lastVisited.join(', ')}}'
                WHERE id = ${requesting};
            `;
            client
                .query(query);
        });
};

app.post('/requestionAction', (req, res) => {
    let query = `
        SELECT id FROM users
        WHERE login = '${req.body.login}'
    `;

    client
        .query(query)
        .then(result => {
            query = `
                UPDATE requests
                SET status = ${req.body.status}
                WHERE target = '${result.rows[0].id}' AND requesting = '${req.body.requesting}';
            `;

            client
                .query(query)
                .then(result => { res.send({result: true})});
        });
});

app.post('/adminRequestionAction', (req, res) => {
    let query = `
         SELECT login FROM admins WHERE login = '${req.body.login}' AND password = '${req.body.password}';
    `;
    client.query(query)
        .then(result => {
            if (result.rows[0] !== undefined) {
                query = `
                    UPDATE requests
                    SET status = ${req.body.status}
                    WHERE target = '${req.body.target}' AND requesting = '${req.body.requesting}';
                `;

                client
                    .query(query)
                    .then(result => { res.send({result: true})});
            }
        });
});

app.post('/loginPost', (req, res) => {
    let login = req.body.login.toLowerCase();

    let query = `
         SELECT id FROM users 
         WHERE login = '${login}' AND password = '${req.body.password}' AND banned = FALSE;
    `;
    client.query(query)
        .then(result => {
        if (result.rows[0] === undefined) {
            res.send({logged: false});
        } else {
            res.send({logged: true, id: result.rows[0].id});
        }
    });
});

app.post('/adminLoginPost', (req, res) => {
    let login = req.body.login.toLowerCase();

    let query = `
         SELECT login FROM admins WHERE login = '${login}' AND password = '${req.body.password}';
    `;
    client.query(query)
        .then(result => {
            if (result.rows[0] === undefined) {
                res.send({logged: false});
            } else {
                res.send({logged: true});
            }
        });
});

app.post('/deleteUser', (req, res) => {
    let query = `
        UPDATE users
        SET banned = ${req.body.deleted}
        WHERE login = '${req.body.login}' AND password = '${req.body.password}';
    `;
    client.query(query)
        .then(result => { res.send(); });
});

function makeSelectWhereQuery(oldBranches){
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
}

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

function makeUpdateBranchesQuery(oldBranches, newBranches, deleted){
    return `
        ${makeDeleteWhereQuery(oldBranches)}
        ${makeInsertQuery(newBranches)}
        ${makeUpdateQuery(oldBranches)}
        ${makeUpdateBranchesFromUsersQuery(deleted)}
    `;
}

app.post('/updateBranches', (req, res) => {
    let oldBranches = req.body.branches.filter(branch => branch[0] !== -1);
    let newBranches = req.body.branches.filter(branch => branch[0] === -1);
    let query = `
        ${makeSelectWhereQuery(oldBranches)}
    `;

    client.query(query)
        .then(result => {
            query = makeUpdateBranchesQuery(oldBranches, newBranches, result.rows);
            client.query(query)
                .then(result => { res.send(); });
        });
});

app.post('/adminGetAllRequests', (req, res) => {
    let login = req.body.login.toLowerCase();

    let query = `
         SELECT login FROM admins WHERE login = '${login}' AND password = '${req.body.password}';
    `;
    client.query(query)
        .then(result => {
            if (result.rows[0] !== undefined) {
                query=`
                    SELECT * FROM requests
                    ${req.body.status !== '' ? `WHERE status = ${req.body.status}` : ''}
                    ORDER BY sendDate ${req.body.asc ? 'ASC' : 'DESC'};
                `;
                client.query(query)
                    .then(requests => {
                        query=`
                            SELECT id, name FROM users;
                        `;
                        client.query(query)
                            .then(users => {
                                let requestsToSend = [];
                                for (let row of requests.rows){
                                    let request = [];

                                    let date = row.senddate;
                                    date.setDate(date.getDate() + 1);
                                    let user = findNameById(users.rows, row.target);
                                    request.push(user[0], user[1]);
                                    user = findNameById(users.rows, row.requesting);
                                    request.push(user[0], user[1]);
                                    request.push(row.status, date.toISOString().substr(0,10),);
                                    requestsToSend.push(request);
                                }
                                res.send({express: requestsToSend})
                            });
                    });
            } else {
                res.send({logged: true});
            }
        });
});

app.post('/getInfoAbout', (req, res) => {
    onAddInLastVisited(req.body.id, req.body.requesting);
    let query = `
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
        WHERE id = '${req.body.id}';
    `;

    client
        .query(query)
        .then(result => {
            if (result.rows !== undefined) {
                query = `
                    SELECT status FROM requests
                    WHERE target = '${req.body.id}' AND requesting = '${req.body.requesting}';
                `;
                client
                    .query(query)
                    .then(status => {
                        let row = result.rows[0];
                        res.send({
                            result: true,
                            id: row.id,
                            birthDate: `${row.birthdate.getDate()}.
                                ${row.birthdate.getMonth()}
                                ${!row.hideyear ? '.' + row.birthdate.getFullYear() : ''}`,
                            privatePhone1: row.hidephones && status.rows[0]?.status !== 1 ? undefined : row.privatephone1,
                            privatePhone2: row.hidephones && status.rows[0]?.status !== 1 ? undefined : row.privatephone2,
                            privatePhone3: row.hidephones && status.rows[0]?.status !== 1 ? undefined : row.privatephone3,
                            name: row.name,
                            workPhone: row.workphone,
                            branch: row.branch,
                            position: row.position,
                            workPlace: row.workplace,
                            about: row.about,
                            avatar: row.avatar,
                        });
                    })
            }
            else{
                res.send({result: false});
            }
        });
});

app.post('/registerOrChange', (req, res) => {
    let query = `
        SELECT id FROM users
        WHERE login = '${req.body.oldLogin}' AND password = '${req.body.oldPassword}';
    `;
    client
        .query(query)
        .then(result => {
            if (result.rows[0] !== undefined){
                updateUserData(req);
            }
            else{
                createNewUser(req);
            }
        });
    res.send();
});

app.post('/getMyPage', (req, res) => {
    let query = `
        SELECT *
        FROM users
        WHERE login = '${req.body.login.toLowerCase()}';
    `;

    client
        .query(query)
        .then(result => {
            if (result.rows[0] !== undefined) {
                let row = result.rows[0];
                let bDate = row.birthdate;
                bDate.setDate(bDate.getDate() + 1);
                res.send({
                    result: true,
                    login: row.login,
                    password: row.password,
                    birthDate: bDate.toISOString().substr(0,10),
                    privatePhone1: row.privatephone1,
                    privatePhone2: row.privatephone2,
                    privatePhone3: row.privatephone3,
                    name: row.name,
                    workPhone: row.workphone,
                    branch: row.branch,
                    position: row.position,
                    workPlace: row.workplace,
                    hideYear: row.hideyear,
                    hidePhones: row.hidephones,
                    about: row.about,
                    deleted: row.banned,
                    avatar: row.avatar,
                });
            }
            else{
                res.send({result: false});
            }
        });
});

app.post('/userValidate', (req, res) => {
    let query = `
        SELECT login FROM users
        WHERE login = '${req.body.login}';
    `;

    client
        .query(query)
        .then(result => {
            let row = result.rows[0];

            res.send({
                validate: row === undefined
            });
        });
});

app.post('/requestAccess', (req, res) => {
    let query = `
        SELECT id FROM users
        WHERE login = '${req.body.requestionLogin}';
    `;
    client
        .query(query)
        .then(resId => {

            query = `
                SELECT status FROM requests
                WHERE target = '${req.body.requestedId}' AND requesting = '${resId.rows[0].id}';
            `;
            client
                .query(query)
                .then(result => {
                    if (result.rows[0] === undefined){
                        query = `
                            INSERT INTO requests (target, requesting, status, sendDate)
                            VALUES ('${req.body.requestedId}', '${resId.rows[0].id}', 0, to_timestamp(${Date.now()} / 1000.0));
                        `;
                        client
                            .query(query)
                            .then(result => {
                                res.send({requested: 2});
                            });
                    }
                    else {
                        res.send({requested: result.rows[0].status});
                    }
                });
        });
});

if (process.env.NODE_ENV === 'production') {
    // Serve any static files
    app.use(express.static(path.join(__dirname, 'client/build')));
    // Handle React routing, return all requests to React app
    app.get('*', function(req, res) {
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    });
}

app.listen(port, () => console.log(`Listening on port ${port}`));