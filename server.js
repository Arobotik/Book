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

let limit = 5;

app.get('/api/checkSession/:sessionId', (req, res) => {
    res.send({logged: serverutils.checkConnection(req.params["sessionId"])});
});

app.get('/api/checkAdminSession/:sessionId', (req, res) => {
    res.send({logged: serverutils.checkAdminConnection(req.params["sessionId"])});
});

app.get('/api/users/:page/:filter/:asc', (req, res) => {
    let filter = req.params["filter"].slice(6);
    client
        .query(querycreate.usersFilterSelect(filter, limit, req.params["page"], req.params["asc"]))
        .then(result => {
            client
                .query(querycreate.selectCount(filter))
                .then(count => {
                    let usersToSend = [];
                    for (let row of result.rows) {
                        usersToSend.push([row.id, row.name]);
                    }
                    res.send({
                        express: usersToSend,
                        pageCount: Math.ceil(count.rows[0].userscount / limit)
                    });
                })
        });

    toSend = null;
    anotherUserToSend = null;
});

app.get('/api/branches/:asc', (req, res) => {
    client.query(querycreate.selectAllBranches(req.params["asc"]))
        .then(result => {
            let branchesToSend = [];
            for (let row of result.rows){
                let branch = [row.id, row.branch];
                branchesToSend.push(branch);
            }
            res.send({express: branchesToSend});
        });
});

app.get('/api/requests/:sessionId', (req, res) => {
    client
        .query(querycreate.selectAllRequests(serverutils.getIdBySession(req.params["sessionId"])))
        .then(result => {
            let requestsToSend = [];
            for (let row of result.rows) {
                requestsToSend.push([row.requesting, row.name]);
            }
            res.send({result: true, express: requestsToSend});
        })
        .catch(() =>
            res.send({result: false,})
        );


    toSend = null;
    anotherUserToSend = null;
});

app.get('/api/lastVisited/:sessionId', (req, res) => {
    client
        .query(querycreate.selectLastVisited(serverutils.getIdBySession(req.params["sessionId"])))
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

app.patch('/api/requests/:sessionId/:requesting', (req, res) => {
    let resp = true;
    client
        .query(querycreate.updateRequests(req.body.status, serverutils.getIdBySession(req.params["sessionId"]), req.params["requesting"]))
        .catch(() => resp = false)
        .then(() => {
            res.send({result: resp})
        });
});

app.patch('/admin/requests/:sessionId', (req, res) => {
    if (serverutils.adminConnections.find(item => item === req.params["sessionId"])) {
        let resp = true;
        client
            .query(querycreate.updateRequests(req.body.status, req.body.target, req.body.requesting))
            .catch(() => resp = false)
            .then(() => {
                res.send({result: resp})
            });
    }
    else{
        res.send({result:false});
    }
});

app.post('/api/login', (req, res) => {
    let login = req.body.login.toLowerCase();
    client.query(querycreate.selectId(login, serverutils.encrypt(req.body.password)))
        .then(result => {
        if (result.rows[0] === undefined) {
            res.send({result: false});
        } else {
            if (serverutils.decrypt(req.body.password, result.rows[0].password)) {
                res.send({result: true, id: result.rows[0].id, sessionId: serverutils.makeAuth(result.rows[0].id),});
            }
            else{
                res.send({result: false});
            }
        }
    });
});

app.post('/admin/login', (req, res) => {
    let login = req.body.login.toLowerCase();
    client.query(querycreate.selectAdmin(login))
        .then(result => {
            if (result.rows[0] === undefined) {
                res.send({result: false});
            } else {
                if (serverutils.decrypt(req.body.password, result.rows[0].password)){
                    res.send({result: true, sessionId: serverutils.makeAuth(req.body.login, true),});
                }
                else{
                    res.send({result: false});
                }
            }
        });
});

app.delete('/api/deleteUser/:id/:deleted', (req, res) => {
    if (serverutils.adminConnections.find(item => item === req.body.session)) {
        let resp = true;
        client.query(querycreate.updateUserBanned(req.params["deleted"], req.params["id"]))
            .catch(() =>
                resp = false)
            .then(() => {
                res.send({result: resp});
        });
    }
    else{
        res.send({result: false});
    }
});


app.patch('/admin/branches', (req, res) => {
    if (serverutils.adminConnections.find(item => item === req.body.session)) {
        let resp = true;
        let oldBranches = req.body.branches.filter(branch => branch[0] !== -1);
        let newBranches = req.body.branches.filter(branch => branch[0] === -1);
        client.query(querycreate.makeSelectWhereQuery(oldBranches))
            .then(result => {
                client.query(querycreate.makeUpdateBranchesQuery(oldBranches, newBranches, result.rows))
                    .catch(() =>
                        resp = false);
                    })
                .then(() => {
                        res.send({result: resp});
                    });
    }
    else{
        res.send({result: false});
    }
});

app.get('/admin/users/:sessionId/:page/:filter/:deleted/:asc', (req, res) => {
    let filter = req.params["filter"].slice(6);
    if (serverutils.adminConnections.find(item => item === req.params["sessionId"])) {
        client
            .query(querycreate.usersFilterSelect(filter, limit, req.params["page"], req.params["asc"], req.params["deleted"]))
            .then(result => {
                client
                    .query(querycreate.selectCount(filter, req.params["deleted"]))
                    .then(count => {
                        let usersToSend = [];
                        for (let row of result.rows) {
                            usersToSend.push([row.id, row.name]);
                        }
                        res.send({
                            express: usersToSend,
                            pageCount: Math.ceil(count.rows[0].userscount / limit)
                        });
                    })
            });

        toSend = null;
        anotherUserToSend = null;
    }
    else{
        res.send({express: false});
    }
});

app.get('/admin/requests/:sessionId/:page/:asc/:status', (req, res) => {
    let status = req.params["status"].slice(6);
    if (serverutils.adminConnections.find(item => item === req.params["sessionId"])) {
        let resp = true;
        client.query(querycreate.selectAllRequestsByAdmin(req.params["page"], limit, status, req.params["asc"]))
            .then(requests => {
                client.query(querycreate.selectIdAndName())
                    .catch(() => resp = false)
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
                        client
                            .query(querycreate.selectRequestsCount(status))
                            .then(count => res.send({
                                result: resp,
                                express: requestsToSend,
                                pageCount: Math.ceil(count.rows[0].requestscount / limit)}));
                    });
            });
    }
    else{
        res.send({result: false});
    }
});

app.get('/api/user/:id/:session', (req, res) => {
    let id = serverutils.getIdBySession(req.params["session"]);
    if (id !== -1 && req.params["id"] !== -1){
        serverutils.onAddInLastVisited(req.params["id"], id, client);

    client
        .query(querycreate.selectUserInfoById(req.params["id"]))
        .then(result => {
            if (result.rows[0] !== undefined) {
                client
                    .query(querycreate.selectRequestsStatus(req.params["id"], serverutils.getIdBySession(req.params["session"])))
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

app.put('/admin/users/:sessionId', (req, res) => {
    if (serverutils.adminConnections.find(item => item === req.params["sessionId"])){
        client
            .query(querycreate.updateUserData(req, true));
    }
    res.send();
});

app.post('/api/users', (req, res) => {
    let resp = true;
    if (serverutils.getIdBySession(req.body.session) !== -1){
        client
            .query(querycreate.updateUserData(req))
            .catch(() => resp = false)
            .then(() => res.send({result: resp}));
    }
    else{
        client
            .query(querycreate.createNewUser(req))
            .catch(() => resp = false)
            .then(() => res.send({result: resp}));
    }
});

app.get('/api/me/:sessionId/:id', (req, res) => {
    let id;
    if (serverutils.adminConnections.find(item => item === req.params["sessionId"])){
        id = req.params["id"];
    }
    else {
        id = serverutils.getIdBySession(req.params["sessionId"]);
    }
    if (id !== undefined) {
        let resp = true;
        client
            .query(querycreate.selectAllInfo(id))
            .catch(() => resp = false)
            .then(result => {
                if (result.rows[0] !== undefined) {
                    let row = result.rows[0];
                    let bDate = row.birthdate;
                    bDate.setDate(bDate.getDate() + 1);
                    res.send({
                        result: resp,
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
            })
    }
    else{
        res.send({result: false});
    }
});

app.get('/api/validate/:login', (req, res) => {
    client
        .query(querycreate.selectLogin(req.params["login"]))
        .then(result => {
            let row = result.rows[0];

            res.send({
                result: row === undefined
            });
        })
        .catch(()=>res.send({result: false}));
});

app.post('/api/requests', (req, res) => {
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
    app.use(express.static(path.join(__dirnam.e, 'client/build')));
    // Handle React routing, return all requests to React app
    app.get('*', function(req, res) {
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    });
}

app.listen(port, () => console.log(`Listening on port ${port}`));