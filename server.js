const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const configuration = require('./config');
const port = process.env.PORT || configuration.PORT;
const migrations = require('./migrations');
const querycreate = require('./querycreate');
const serverutils = require('./serverutils');
const pg = require('pg');

const config = configuration.config;

const client = new pg.Client(config);

client.connect(err => {
    if (err) throw err;
    else {
        migrations.createDatabase(client);
    }
});

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// API calls
let toSend = null;
let anotherUserToSend = null;

let limit = 2;

app.post('/checkSession', (req, res) => {
    res.send({logged: serverutils.checkConnection(req.body.session)});
});

app.post('/checkAdminSession', (req, res) => {
    res.send({logged: serverutils.checkAdminConnection(req.body.session)});
});

app.post('/bookAllGet', (req, res) => {
    client
        .query(querycreate.usersFilterSelect(req.body.filter, limit, req.body.page))
        .then(result => {
            client
                .query(querycreate.selectCount(req.body.filter))
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
    client.query(querycreate.selectAllBranches())
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
    client
        .query(querycreate.selectAllRequests(serverutils.getIdBySession(req.body.session)))
        .then(result => {
            let requestsToSend = [];
            for (let row of result.rows) {
                requestsToSend.push([row.requesting, row.name]);
            }
            res.send({express: requestsToSend});
        });


    toSend = null;
    anotherUserToSend = null;
});

app.post('/bookAllGetByAdmin', (req, res) => {
    if (serverutils.adminConnections.find(item => item === req.body.session)) {
        client
            .query(querycreate.selectAllUsersByBanned(req.body.deleted))
            .then(result => {
                let usersToSend = [];
                for (let row of result.rows) {
                    usersToSend.push([row.id, row.name]);
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

app.post('/getLastVisited', (req, res) => {
    client
        .query(querycreate.selectLastVisited(serverutils.getIdBySession(req.body.session)))
        .then(result => {
            if (result.rows[0] !== undefined && result.rows[0].lastvisited !== null){
                client
                    .query(querycreate.selectItemsForCarousel(result.rows[0].lastvisited))
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

app.post('/requestionAction', (req, res) => {
    client
        .query(querycreate.updateRequests(req.body.status, serverutils.getIdBySession(req.body.session), req.body.requesting))
        .then(result => { res.send({result: true})});
});

app.post('/adminRequestionAction', (req, res) => {
    if (serverutils.adminConnections.find(item => item === req.body.session)) {
        client
            .query(querycreate.updateRequests(req.body.status, req.body.target, req.body.requesting))
            .then(result => {
                res.send({result: true})
            });
    }
    else{
        res.send({result:false});
    }
});

app.post('/loginPost', (req, res) => {
    let login = req.body.login.toLowerCase();
    client.query(querycreate.selectId(login, serverutils.encrypt(req.body.password)))
        .then(result => {
        if (result.rows[0] === undefined) {
            res.send({logged: false});
        } else {
            if (serverutils.decrypt(req.body.password, result.rows[0].password)) {
                res.send({logged: true, id: result.rows[0].id, sessionId: serverutils.makeAuth(result.rows[0].id),});
            }
            else{
                res.send({logged: false});
            }
        }
    });
});

app.post('/adminLoginPost', (req, res) => {
    let login = req.body.login.toLowerCase();
    client.query(querycreate.selectAdmin(login))
        .then(result => {
            if (result.rows[0] === undefined) {
                res.send({logged: false});
            } else {
                if (serverutils.decrypt(req.body.password, result.rows[0].password)){
                    res.send({logged: true, sessionId: serverutils.makeAuth(req.body.login, true),});
                }
                else{
                    res.send({logged: false});
                }
            }
        });
});

app.post('/deleteUserByAdmin', (req, res) => {
    if (serverutils.adminConnections.find(item => item === req.body.session)) {
        client.query(querycreate.updateUserBanned(req.body.deleted, req.body.id))
            .then(result => {
                res.send();
            });
    }
    else{
        res.send();
    }
});


app.post('/updateBranchesByAdmin', (req, res) => {
    if (serverutils.adminConnections.find(item => item === req.body.session)) {
        let oldBranches = req.body.branches.filter(branch => branch[0] !== -1);
        let newBranches = req.body.branches.filter(branch => branch[0] === -1);
        client.query(querycreate.makeSelectWhereQuery(oldBranches))
            .then(result => {
                client.query(querycreate.makeUpdateBranchesQuery(oldBranches, newBranches, result.rows))
                    .then(result => {
                        res.send();
                    });
            });
    }
});

app.post('/adminGetAllRequests', (req, res) => {
    if (serverutils.adminConnections.find(item => item === req.body.session)) {
        client.query(querycreate.selectAllRequestsByAdmin(req.body.status, req.body.asc))
            .then(requests => {
                client.query(querycreate.selectIdAndName())
                    .then(users => {
                        let requestsToSend = [];
                        for (let row of requests.rows) {
                            let request = [];
                            let date = row.senddate;
                            date.setDate(date.getDate() + 1);
                            let user = serverutils.findNameById(users.rows, row.target);
                            request.push(user[0], user[1]);
                            user = serverutils.findNameById(users.rows, row.requesting);
                            request.push(user[0], user[1]);
                            request.push(row.status, date.toISOString().substr(0, 10),);
                            requestsToSend.push(request);
                        }
                        res.send({express: requestsToSend})
                    });
            });
    }
    else{
        res.send({result: false});
    }
});

app.post('/getInfoAbout', (req, res) => {
    let id = serverutils.getIdBySession(req.body.session);
    if (id !== -1 && req.body.id !== -1){
        serverutils.onAddInLastVisited(req.body.id, id, client);

    client
        .query(querycreate.selectUserInfoById(req.body.id))
        .then(result => {
            if (result.rows !== undefined) {
                client
                    .query(querycreate.selectRequestsStatus(req.body.id, serverutils.getIdBySession(req.body.session)))
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
    }
    else{
        res.send({result: false});
    }
});

app.post('/changeByAdmin', (req, res) => {
    if (serverutils.adminConnections.find(item => item === req.body.session)){
        client
            .query(querycreate.updateUserData(req, true));
    }
    res.send();
});

app.post('/registerOrChange', (req, res) => {
    if (serverutils.getIdBySession(req.body.session) !== -1){
        client
            .query(querycreate.updateUserData(req));
    }
    else{
        client
            .query(querycreate.createNewUser(req));
    }
    res.send();
});

app.post('/getMyPage', (req, res) => {
    let id;
    if (serverutils.adminConnections.find(item => item === req.body.session)){
        id = req.body.id;
    }
    else {
        id = serverutils.getIdBySession(req.body.session);
    }
    if (id !== undefined) {
        client
            .query(querycreate.selectAllInfo(id))
            .then(result => {
                if (result.rows[0] !== undefined) {
                    let row = result.rows[0];
                    let bDate = row.birthdate;
                    bDate.setDate(bDate.getDate() + 1);
                    res.send({
                        result: true,
                        login: row.login,
                        password: '',
                        birthDate: bDate.toISOString().substr(0, 10),
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
                } else {
                    res.send({result: false});
                }
            });
    }
    else{
        res.send({result: false});
    }
});

app.post('/userValidate', (req, res) => {
    client
        .query(querycreate.selectLogin(req.body.login))
        .then(result => {
            let row = result.rows[0];

            res.send({
                validate: row === undefined
            });
        });
});

app.post('/requestAccess', (req, res) => {
            client
                .query(querycreate.selectRequestsStatus(req.body.requestedId, serverutils.getIdBySession(req.body.session)))
                .then(result => {
                    if (result.rows[0] === undefined){
                        client
                            .query(querycreate.insertNewRequest(req.body.requestedId, serverutils.getIdBySession(req.body.session)))
                            .then(result => {
                                res.send({requested: 2});
                            });
                    }
                    else {
                        res.send({requested: result.rows[0].status});
                    }
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