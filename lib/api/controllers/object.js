'use strict';
const commonLib = require('./common.js');

module.exports = {
    readObject: function (req, res) {
        commonLib.checkPermissions(req._adapter, req._user, [{type: 'object', operation: 'read'}], error => {
            if (error) {
                commonLib.errorResponse(req, res, error);
            } else {
                const params = commonLib.parseUrl(req.url, req.swagger, req._adapter.WEB_EXTENSION_PREFIX);
                req._adapter.getForeignObject(params.objectId, {user: req._user, limitToOwnerRights: req._adapter.config.onlyAllowWhenUserIsOwner}, (error, obj) => {
                    if (error) {
                        commonLib.errorResponse(req, res, error, {objectId: req.query.objectId});
                    } else {
                        if (!obj) {
                            res.status(404).json({error: 'object not found'});
                        } else {
                            res.json(obj);
                        }
                    }
                });
            }
        });
    },

    updateObject: function (req, res) {
        commonLib.checkPermissions(req._adapter, req._user, [{type: 'object', operation: 'write'}], async error => {
            if (error) {
                commonLib.errorResponse(req, res, error);
            } else {
                const params = commonLib.parseUrl(req.url, req.swagger, req._adapter.WEB_EXTENSION_PREFIX);
                const body = req.body;
                try {
                    const obj = await req._adapter.getForeignObjectAsync(params.objectId, {user: req._user, limitToOwnerRights: req._adapter.config.onlyAllowWhenUserIsOwner});
                    if (!obj) {
                        await req._adapter.setForeignObjectAsync(params.objectId, body, {user: req._user, limitToOwnerRights: req._adapter.config.onlyAllowWhenUserIsOwner});
                        res.status(200).json(body);
                    } else {
                        // merge objects together
                        Object.keys(body).forEach(attr => {
                            if (body[attr] === null || body[attr] === undefined) {
                                delete obj[attr];
                            } else
                            if (typeof body[attr] === 'object') {
                                obj[attr] = obj[attr] || {};
                                Object.keys(body[attr]).forEach(attr2 => {
                                    if (body[attr][attr2] === null) {
                                        delete obj[attr][attr2];
                                    } else {
                                        obj[attr][attr2] = body[attr][attr2];
                                    }
                                })
                            } else {
                                obj[attr] = body[attr];
                            }
                        });
                        await req._adapter.setForeignObjectAsync(params.objectId, obj, {user: req._user, limitToOwnerRights: req._adapter.config.onlyAllowWhenUserIsOwner});
                        res.status(200).json(obj);
                    }
                } catch (error) {
                    commonLib.errorResponse(req, res, error, {objectId: params.objectId});
                }
            }
        });
    },

    createObject: function (req, res) {
        commonLib.checkPermissions(req._adapter, req._user, [{type: 'object', operation: 'write'}], async error => {
            if (error) {
                commonLib.errorResponse(req, res, error);
            } else {
                const params = commonLib.parseUrl(req.url, req.swagger, req._adapter.WEB_EXTENSION_PREFIX);
                const body = req.body;
                try {
                    const obj = await req._adapter.getForeignObjectAsync(params.objectId, {user: req._user, limitToOwnerRights: req._adapter.config.onlyAllowWhenUserIsOwner});
                    if (!obj) {
                        await req._adapter.setForeignObjectAsync(params.objectId, body, {user: req._user, limitToOwnerRights: req._adapter.config.onlyAllowWhenUserIsOwner});
                        res.status(200).json(body);
                    } else {
                        res.status(409).json({error: 'Object already exists', id: params.objectId});
                    }
                } catch (error) {
                    commonLib.errorResponse(req, res, error, {objectId: params.objectId});
                }
            }
        });
    },

    deleteObject: function (req, res) {
        commonLib.checkPermissions(req._adapter, req._user, [{type: 'object', operation: 'write'}], async error => {
            if (error) {
                commonLib.errorResponse(req, res, error);
            } else {
                const params = commonLib.parseUrl(req.url, req.swagger, req._adapter.WEB_EXTENSION_PREFIX);
                try {
                    const obj = await req._adapter.getForeignObjectAsync(params.objectId, {user: req._user, limitToOwnerRights: req._adapter.config.onlyAllowWhenUserIsOwner});
                    if (!obj) {
                        res.status(404).json({objectId: params.objectId, error: 'object not found'});
                    } else {
                        await req._adapter.delForeignObjectAsync(params.objectId, {user: req._user, limitToOwnerRights: req._adapter.config.onlyAllowWhenUserIsOwner});
                        res.status(200).json({});
                    }
                } catch (error) {
                    commonLib.errorResponse(req, res, error, {objectId: params.objectId});
                }
            }
        });
    },

    listObjects: function (req, res) {
        commonLib.checkPermissions(req._adapter, req._user, [{type: 'object', operation: 'read'}], error => {
            if (error) {
                commonLib.errorResponse(req, res, error);
            } else {
                req._adapter.getForeignObjects(req.query.filter || '*', req.query.type || null, {
                    user: req._user,
                    limitToOwnerRights: req._adapter.config.onlyAllowWhenUserIsOwner
                }, (error, list) => {
                    if (error) {
                        commonLib.errorResponse(req, res, error, {filter: req.query.filter});
                    } else {
                        res.json(list || []);
                    }
                });
            }
        });
    },

    subscribeObject: function (req, res) {
        commonLib.checkPermissions(req._adapter, req._user, [{type: 'object', operation: 'read'}], async error => {
            if (error) {
                commonLib.errorResponse(req, res, error);
            } else {
                const params = commonLib.parseUrl(req.url, req.swagger, req._adapter.WEB_EXTENSION_PREFIX);

                let url = req.body.url;
                if ((req.query && req.query.method === 'polling') || (req.body && req.body.method === 'polling')) {
                    url = req.query.sid || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
                }

                if (!url) {
                    res.status(422).json({error: 'url not provided', expectedBody: {url: 'http://ipaddress:9000/hook/'}});
                    return;
                }

                try {
                    const obj = await req._adapter.getForeignObjectAsync(params.stateId, {user: req._user, limitToOwnerRights: req._adapter.config.onlyAllowWhenUserIsOwner});
                    if (!obj) {
                        res.status(404).json({error: 'object not found'});
                    } else {
                        await req._swaggerObject.registerSubscribe(url, params.objectId, 'object', req._user, (req.query && req.query.method) || (req.body && req.body.method));
                        const obj = await req._adapter.getForeignStateAsync(params.objectId, {user: req._user, limitToOwnerRights: req._adapter.config.onlyAllowWhenUserIsOwner});
                        res.status(200).json(obj);
                    }
                } catch (error) {
                    req._adapter.log.warn(`Cannot read ${params.objectId}: ${error}`);
                    commonLib.errorResponse(req, res, error, {objectId: params.objectId});
                }
            }
        });
    },

    unsubscribeObject: function (req, res) {
        commonLib.checkPermissions(req._adapter, req._user, [{type: 'object', operation: 'read'}], async error => {
            if (error) {
                commonLib.errorResponse(req, res, error);
            } else {
                const params = commonLib.parseUrl(req.url, req.swagger, req._adapter.WEB_EXTENSION_PREFIX);

                let url = req.body.url;
                if ((req.query && req.query.method === 'polling') || (req.body && req.body.method === 'polling')) {
                    url = req.query.sid || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
                }

                if (!url) {
                    res.status(422).json({error: 'url not provided', expectedBody: {url: 'http://ipaddress:9000/hook/'}});
                    return;
                }
                try {
                    await req._swaggerObject.unregisterSubscribe(url, params.objectId, 'object', req._user, (req.query && req.query.method) || (req.body && req.body.method));
                    res.status(200).json({result: 'OK'});
                } catch (error) {
                    commonLib.errorResponse(req, res, error, {objectId: params.objectId});
                }
            }
        });
    },

    subscribeObjects: function (req, res) {
        commonLib.checkPermissions(req._adapter, req._user, [{type: 'object', operation: 'read'}], async error => {
            if (error) {
                commonLib.errorResponse(req, res, error);
            } else {
                let url = req.body.url;
                if (req.body.method === 'polling') {
                    url = req.query.sid || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
                }

                if (!url) {
                    res.status(422).json({error: 'url not provided', expectedBody: {url: 'http://ipaddress:9000/hook/'}});
                    return;
                }
                if (!req.body.pattern) {
                    res.status(422).json({
                        error: 'pattern not provided',
                        expectedBody: {url: 'http://ipaddress:9000/hook/', pattern: 'system.adapter.admin.0.*'}
                    });
                    return;
                }
                try {
                    await req._swaggerObject.registerSubscribe(url, req.body.pattern, 'object', req._user, req.body.method);
                } catch (error) {
                    commonLib.errorResponse(req, res, error, {pattern: req.body.pattern, url: req.body.url});
                }
            }
        });
    },

    unsubscribeObjects: function (req, res) {
        commonLib.checkPermissions(req._adapter, req._user, [{type: 'object', operation: 'read'}], async error => {
            if (error) {
                commonLib.errorResponse(req, res, error);
            } else {
                let url = req.body.url;
                if (req.body.method === 'polling') {
                    url = req.query.sid || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
                }

                if (!url) {
                    res.status(422).json({error: 'url not provided', expectedBody: {url: 'http://ipaddress:9000/hook/'}});
                    return;
                }

                try {
                    await req._swaggerObject.unregisterSubscribe(url, req.body.pattern, 'object', req._user, req.body.method);
                    res.status(200).json({result: 'OK'});
                } catch (error) {
                    commonLib.errorResponse(req, res, error, {pattern: req.body.pattern, url: req.body.url});
                }
            }
        });
    },

    getObjectsSubscribes: function (req, res) {
        commonLib.checkPermissions(req._adapter, req._user, [{type: 'state', operation: 'read'}], async error => {
            if (error) {
                commonLib.errorResponse(req, res, error);
            } else {
                let url = req.body.url;
                if ((req.query && req.query.method === 'polling') || (req.body && req.body.method === 'polling')) {
                    url = req.query.sid || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
                }

                if (!url) {
                    res.status(422).json({error: 'url not provided', expectedBody: {url: 'http://ipaddress:9000/hook/'}});
                    return;
                }

                try {
                    const result = await req._swaggerObject.getSubscribes(url, req.body.pattern, 'object');
                    if (result === null) {
                        res.status(404).json({error: 'URL or session not found'});
                        return;
                    }
                    res.json({states: result});

                } catch (error) {
                    commonLib.errorResponse(req, res, error, {pattern: req.body.pattern, url: req.body.url});
                }
            }
        });
    },
};
