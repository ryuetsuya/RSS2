export default (router) => {
    router.get('/rss/:id/:routeParams?', './rss');
};
