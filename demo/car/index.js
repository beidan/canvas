/**
 * Created by peidan on 2017/7/19.
 */

'use strict';

/**
 * @author peidan
 * @date 2017-6-26
 * @desc 主页
 */
;(function () {
    function Event() {
        // 定义的事件与回调
        this.defineEvent = {};
    }

    Event.prototype = {
        on: function (event, cb) {
            this.register(event, cb); // 注册一个事件名字和回调
        },
        dispatch: function (event, arg) {
            if (this.defineEvent[event]) {
                {
                    for (var i = 0, len = this.defineEvent[event].length; i < len; ++i) {
                        this.defineEvent[event][i](arg);
                    }
                }
            }
        },
        register: function (event, cb) {
            !this.defineEvent[event] ? (this.defineEvent[event] = [cb]) : this.defineEvent[event].push(cb);
        },
        removeEvent: function () {
            //销毁自定义事件
            for (var i in this.defineEvent) {
                delete this.defineEvent[i];
            }
        }
    }

    function CarGame(allTime, propMill, fixM) {
        this.speed = 10;  //默认速度
        this.backdrop;  //背景图
        this.tmp = [];
        this.easel = document.getElementById("gameView");  //画布
        this.stage = new createjs.Stage('gameView');

        this.changem; //清里程
        this.props = []; //存放道具
        this.propsTmp = [];  //存放临时数组
        this.showOne = 1;
        this.crash = {  //所有物体占的位置,用于碰撞检测
            car: {},
            obstacle: []
        };
        this.objCash = []; //障碍物缓存

        this.quickstate; //加速的定时
        this.slowstate;

        this.propMill = propMill; //道具增加或减少路程的值
        this.fixM = fixM;  //里程加速的默认值
        this.allTime = allTime; //倒计时间

        createjs.Ticker.timingMode = createjs.Ticker.RAF;

        //自定义事件监听
        this.event = new Event();
    }

    CarGame.prototype = {
        //初始化
        init: function (manifest) {
            if (!this.easel) {
                // 缺少画布，初始化失败
                // console.log('缺少画布，初始化失败');
                return;
            }
            this.preLoad(manifest);
            //时间倒计时
            this.prepare(3, 3);
            this.bindEvent();
        },
        //绑定事件
        bindEvent: function () {
            var cw = Math.min(document.body.clientWidth, 540), that = this,
                ratio = 750 / cw, startX, startY, islock;

            this.easel.addEventListener("touchstart", handleTouchStart);
            this.easel.addEventListener("touchmove", handleTouchMove);

            function handleTouchStart(e) {
                e.preventDefault();
                var touch = e.targetTouches[0];
                startX = touch.pageX * ratio;
                startY = touch.pageY * ratio;
                islock = 0;
            }

            function handleTouchMove(e) {
                e.preventDefault();
                if (islock) return;
                var touch = e.targetTouches[0],
                    x = touch.pageX * ratio;

                if (x - startX >= 30) {
                    // console.log('向右')
                    islock = 1;
                    that.turnRight();// 向右
                }
                else if (x - startX <= -30) {
                    // console.log('向左')
                    that.turnLeft();
                    islock = 1;
                }
            }
        },
        //3秒倒计时
        prepare: function (num, nowTime) {
            document.querySelector('#J_car_guide_countdown').classList.remove('hide');
            var prepare = document.querySelector('#J_car_guide_num');

            prepare.innerText = nowTime;
            var that = this;
            nowTime -= 1;
            if (nowTime < 0) {
                document.querySelector('#J_car_guide_countdown').classList.add('hide');
                that.event.dispatch("prepareComplete");

                //恢复动画
                createjs.Ticker.paused = 0;

                that.gameTime(that.allTime, that.allTime);
                // that.changeMileage();
            } else {
                this.countdown = setTimeout(function () {
                    that.prepare(num, nowTime);
                }, 1000);
            }
        },
        //预加载图片
        preLoad: function (manifest) {
            var queue = new createjs.LoadQueue(false);
            queue.on('complete', handleComplete, this);
            queue.loadManifest(manifest);

            //资源加载成功后
            function handleComplete() {
                var image = queue.getResult('roadb'),
                    car = queue.getResult('car'),
                    effbomb = queue.getResult('effbomb'),
                    effquick = queue.getResult('effquick'),
                    effslow = queue.getResult('effslow'),
                    bg1 = queue.getResult('bg1');
                //障碍物
                var obj = {
                    quickObject: [
                        {
                            type: '汽油',
                            target: queue.getResult('gas')
                        }, {
                            type: '导航',
                            target: queue.getResult('nav')
                        }, {
                            type: '轮胎',
                            target: queue.getResult('tyre')
                        }],
                    slowObject: [
                        {
                            type: '冰块',
                            target: queue.getResult('ice')
                        }
                        , {
                            type: '石头',
                            target: queue.getResult('stone')
                        }, {
                            type: '钉子',
                            target: queue.getResult('snag')
                        }, {
                            type: '路障',
                            target: queue.getResult('roadb')
                        }],
                    overObject: queue.getResult('bomb')
                };

                this.drawBg(bg1);
                this.drawRole(car, effbomb, effquick, effslow);
                this.drawObstacle(obj);
                this.pause();
            }
        },
        //是否重叠  参数， 一个车，一个障碍物
        //重叠返回 true，不重叠返回false
        isCrash: function (car, obst) {
            var carXmax = Math.max(car.x[0], car.x[1]),
                carYmax = Math.max(car.y[0], car.y[1]),
                carXmin = Math.min(car.x[0], car.x[1]),
                carYmin = Math.min(car.y[0], car.y[1]),
                obstXmin = Math.min(obst.x[0], obst.x[1]),
                obstYmin = Math.min(obst.y[0], obst.y[1]),
                obstXmax = Math.max(obst.x[0], obst.x[1]),
                obstYmax = Math.max(obst.y[0], obst.y[1]);

            if (((obstXmin < carXmax) && (obstXmax > carXmin)) && ((obstYmin < carYmax) && (obstYmax > carYmin))) {
                // console.log('碰撞了')
                return {
                    status: true,
                    obj: obst,
                    item: obst.item
                };
            }
            return false;
        },
        //批量销毁
        destroy: function () {
            createjs.Ticker.removeEventListener("tick", this.tick);

            //暂停里程，倒计时
            clearInterval(this.changem);
            clearTimeout(this.gametime);

            this.stage.update();
            createjs.Ticker.paused = 1;
        },
        //绘制背景
        drawBg: function (bg) {
            var that = this, i = 1;
            this.backdrop = new createjs.Bitmap(bg);
            this.backdrop.x = 0;
            this.backdrop.y = 0;
            this.stage.addChild(that.backdrop);
            this.w = bg.width;
            this.h = bg.height;

            //创建一个背景副本，无缝连接
            var copyy = -bg.height;
            this.copy = new createjs.Bitmap(bg);
            this.copy.x = 0;
            this.copy.y = copyy;

            that.stage.addChild(that.backdrop);
            that.stage.addChild(that.copy);

            createjs.Ticker.addEventListener("tick", tick);

            function tick(e) {
                if (e.paused !== 1) {
                    //舞台逐帧逻辑处理函数
                    that.backdrop.y = that.speed + that.backdrop.y;
                    that.copy.y = that.speed + that.copy.y;

                    if (that.copy.y > -40) {
                        that.backdrop.y = that.copy.y + copyy;
                    }
                    if (that.copy.y > -copyy - 100) {
                        that.copy.y = copyy + that.backdrop.y;
                    }
                    // 障碍物逐帧逻辑处理函数
                    var i, len = that.props.length;
                    for (i = 0; i < len; i++) {
                        if (that.props[i]) {
                            that.props[i].y += that.speed;

                            //实时更新障碍物的位置
                            that.crash.obstacle[i] = {
                                x: [that.props[i].x, that.props[i].x + 110],
                                y: [that.props[i].y, that.props[i].y + 128]
                            };

                            //碰撞检测
                            var isc = that.isCrash(that.crash.car, that.crash.obstacle[i]);

                            if (isc) {
                                //绘制特效
                                var name = that.props[i].name;

                                if (name == 'quick') {
                                    // console.log('加速了')
                                    that.changeSpeed('quick', that.props[i].type);
                                } else if (name == 'slow') {
                                    // console.log('减速了')
                                    that.changeSpeed('slow', that.props[i].type);
                                } else if (name == 'over') {
                                    that.gameOver();
                                }
                                that.stage.removeChild(that.props[i]);
                                //删除数组的数据
                                that.props.splice(i, 1);
                                i = i - 1;
                            }
                        }
                    }
                    that.stage.update(e);
                }
            }

            this.tick = tick;
        },
        //绘制汽车
        drawRole: function (car, bomb, quick, slow) {
            var that = this,
                roleGroup = new createjs.Container(),
                car = new createjs.Bitmap(car),
                bomb = new createjs.Bitmap(bomb),
                slow = new createjs.Bitmap(slow),
                quick = new createjs.Bitmap(quick);
            roleGroup.name = 'role';
            roleGroup.addChild(car);

            //绘制特效
            roleGroup.addChild(bomb);
            roleGroup.addChild(quick);
            roleGroup.addChild(slow);
            quick.x = -8;
            quick.y = -4;
            bomb.x = -30;
            bomb.y = -8;

            slow.x = 2;
            slow.y = 0;

            bomb.name = 'bomb';
            quick.name = 'quick';
            slow.name = 'slow';
            bomb.visible = false;
            quick.visible = false;
            slow.visible = false;

            roleGroup.y = 1344 - 156 - 218;
            roleGroup.x = 375 - 50 - 2;

            this.crash.car = {
                x: [roleGroup.x, roleGroup.x + 100],
                y: [roleGroup.y, roleGroup.y + 156]
            };
            this.stage.addChild(roleGroup);
        },
        //随机绘制障碍物
        drawObstacle: function (obj) {
            //随机绘制
            var qIdx = Math.floor((Math.random() * obj.quickObject.length)),
                sIdx = Math.floor((Math.random() * obj.slowObject.length)),
                quick = new createjs.Bitmap(obj.quickObject[qIdx].target),
                slow = new createjs.Bitmap(obj.slowObject[sIdx].target),
                over = new createjs.Bitmap(obj.overObject),
                that = this,
                height = document.querySelector('#gameView').height / 2;

            //限制不能重复画障碍物
            var len = that.props.length, canDraw = false, j;
            for (j = 0; j < len; j++) {
                if (that.props[j].y < 100) {
                    canDraw = true;
                    break;
                }
            }

            if (!canDraw) {
                var num = parseInt(2 * Math.random()) + 1, i;
                for (i = 0; i < num; i++) {
                    var type = parseInt(10 * Math.random()) + 1;

                    // 设置道具出现比例
                    if (type == 1) {
                        //绘制炸弹
                        var ov = over.clone();
                        ov.x = that.getPosition();
                        ov.y = 0;
                        ov.name = 'over';
                        that.props.push(ov);
                    } else if ((type >= 2) && (type <= 5)) {
                        //绘制加速道具
                        var qu = quick.clone();
                        qu.x = that.getPosition();
                        qu.y = 0;
                        qu.type = obj.quickObject[qIdx].type;
                        qu.name = 'quick';
                        that.props.push(qu);
                    } else if ((type >= 6) && (type <= 10)) {
                        //绘制减速道具
                        var sl = slow.clone();
                        sl.x = that.getPosition();
                        sl.y = 0;
                        sl.name = 'slow';
                        sl.type = obj.slowObject[sIdx].type;
                        that.props.push(sl);
                    }
                    that.stage.addChild(that.props[that.props.length - 1]);
                }
            }

            // 删除越界的元素
            for (var i = 0, flag = true, len = that.props.length; i < len; flag ? i++ : i) {
                if (that.props[i]) {
                    if (that.props[i].y > height + 300) {
                        that.stage.removeChild(that.props[i]);
                        that.props.splice(i, 1);
                        flag = false;
                    } else {
                        flag = true;
                    }
                }
            }

            var time = (parseInt(3 * Math.random()) + 1);  //随机取1～3整数

            // 随机时间绘制障碍物
            setTimeout(function () {
                that.propsTmp = [];  //清空
                that.drawObstacle(obj);
            }, time * 400);  //400ms ~ 1200ms
        }
        ,
        //返回随机坐标 x,y
        getPosition: function () {
            var objX, idx = parseInt(3 * Math.random()) + 1;

            if (this.propsTmp.indexOf(idx)) {
                this.propsTmp.push(idx);
            } else {
                if (idx != 1) {
                    idx = 1;
                } else if (idx != 2) {
                    idx = 2;
                } else if (idx != 3) {
                    idx = 3;
                }
                this.propsTmp.push(idx);
            }

            switch (idx) {
                case 1:
                    objX = 165;
                    break;
                case 2:
                    objX = 325;
                    break;
                case 3:
                    objX = 480;
                    break;
                default:
                    break;
            }
            return objX;
        }
        ,
        //倒计时, 参数总时间  time, 当前时间 nowTime
        gameTime: function (time, nowTime) {
            var that = this;
            nowTime -= 1;
            if (nowTime < 0) {
                that.pause();
                that.event.dispatch("timeout");
            } else {
                this.gametime = setTimeout(function () {
                    that.gameTime(time, nowTime);
                    document.querySelector('#J_car_time').innerText = nowTime + '秒';
                }, 1000);
            }
        }
        ,
        //改变速度  参数 quick--加速  slow--变慢  道具名 prop
        changeSpeed: function (speed, prop) {
            var that = this, role = this.stage.getChildByName('role'), qu;

            if (speed == 'quick') {
                clearTimeout(that.quickstate);
                clearTimeout(that.slowstate);

                //增加路程
                // this.setMil('add');
                role.getChildByName('quick').visible = true;
                role.getChildByName('slow').visible = false;

                //显示气泡提示
                that.showText(role, prop, 'quick');

                that.quickstate = setTimeout(function () {
                    role.getChildByName('quick').visible = false;
                }, 3000);
            }
            if (speed == 'slow') {
                //减少路程
                // this.setMil('reduce');
                clearTimeout(that.quickstate);
                clearTimeout(that.slowstate);


                role.getChildByName('slow').visible = true;
                role.getChildByName('quick').visible = false;
                that.showText(role, prop, 'slow');

                that.slowstate = setTimeout(function () {
                    role.getChildByName('slow').visible = false;
                }, 3000);
            }
        }
        ,
        //暂停游戏
        pause: function () {
            //暂停里程，倒计时
            clearInterval(this.changem);
            clearTimeout(this.gametime);

            //暂停动画
            createjs.Ticker.paused = 1;
            this.propsTmp = [];
        }
        ,
        //重新开始
        reStart: function (manifest) {
            this.destroy();



            this.stage.removeAllChildren();
            createjs.Ticker.removeEventListener("tick", this.tick);

            document.querySelector('#J_car_nav_msg').innerText = '0米';

            this.props = []; //存放道具
            this.propsTmp = [];  //存放临时数组
            this.crash = {  //所有物体占的位置,用于碰撞检测
                car: {},
                obstacle: []
            };
            this.objCash = []; //障碍物缓存

            this.event.removeEvent();
            this.init(manifest);
        }
        ,
        turnLeft: function () {
            var car = this.stage.getChildByName("role"), that = this;
            if (car.x < 200) {
                return;
            }

            createjs.Tween.get(car)
                .to({
                    x: car.x - 160
                }, 200);

            this.crash.car = {
                x: [car.x - 160, car.x - 160 + 100],
                y: [car.y, car.y + 156]
            };
        }
        ,
        turnRight: function () {
            var car = this.stage.getChildByName("role");
            if (car.x > 400) {
                return;
            }

            createjs.Tween.get(car)
                .to({
                    x: car.x + 160
                }, 200);

            this.crash.car = {
                x: [car.x + 160, car.x + 160 + 100],
                y: [car.y, car.y + 156]
            };
        }
        ,
        //爆炸，游戏结束
        gameOver: function () {
            this.event.dispatch("gameover");

            //显示爆炸效果
            var car = this.stage.getChildByName("role");
            car.getChildByName('bomb').visible = true;
            car.getChildByName('quick').visible = false;
            car.getChildByName('slow').visible = false;

            //删除提示
            if (car.getChildByName('tip')) {
                car.getChildByName('tip').visible = false;
            }
            this.destroy();
        }
        ,
        //更新里程
        changeMileage: function () {
            var that = this;
            that.changem = setInterval(function () {
                var mile = document.querySelector('#J_car_nav_msg'),
                    road = mile.innerText, x = road.slice(0, road.length - 1);

                mile.innerText = parseInt(x) + that.fixM + '米';

                if ((parseInt(x) + that.fixM) > 3000) {
                    // 显示提示框,超过3000米啦
                    that.showDia();
                }
            }, 100);
        }
        ,
        //3000米提示弹窗
        showDia: function () {
            var dialog = document.querySelector('#J_car_over');
            if (this.showOne) {
                dialog.classList.remove('hide');
                setTimeout(function () {
                    dialog.classList.add('hide');
                }, 2000);
                this.showOne = 0;
            }
        }
        ,
        //设置里程  默认加300米
        //参数 oper  -- add  加300， -- reduce 减300
        setMil: function (oper) {
            var mile = document.querySelector('#J_car_nav_msg'),
                m = mile.innerText,
                num = m.slice(0, m.length - 1);

            if (oper == 'add') {
                mile.innerText = parseInt(num) + this.propMill + '米';
            } else if (oper == 'reduce') {
                mile.innerText = parseInt(num) - this.propMill + '米';

                if (parseInt(num) - this.propMill < 0) {
                    mile.innerText = '0米';
                }
            }
        },
        //获取里程
        getMil: function () {
            var mile = document.querySelector('#J_car_nav_msg').innerText;
            return mile.slice(0, mile.length - 1);
        }
        ,
        //显示提示
        //参数 roleGroup -- 汽车对象, obj -- 获得的物体 , speed -- 加速或者减速
        showText: function (roleGroup, obj, speed) {
            var container = new createjs.Container, arg1, arg;
            container.name = 'tip';

            if (speed == 'quick') {
                arg1 = '增加里程300米'
                arg = '获得' + obj + ',';
            } else {
                arg1 = '减少里程300米'
                arg = '踩到' + obj + ',';
            }
            var w = arg.length * 32 + 20,
                h = 80;
            this.text = new createjs.Text(arg, 24 + "px Arial", '#fff');
            this.text1 = new createjs.Text(arg1, 24 + "px Arial", '#fff');
            this.text.x = 25 + 3;
            this.text.y = 10;
            this.text1.x = 25 + 3;
            this.text1.y = 40;
            this.rect = new createjs.Shape();
            this.rect.graphics.beginFill('#000').drawRoundRect(0, 0, w + 30, h, 6, 6, 6, 6);
            this.tip = new createjs.Shape();
            this.tip.graphics.beginFill('#000').drawRect(0, 0, 24, 24);
            this.tip.rotation = 45;
            this.tip.regX = 40;
            this.tip.regY = 30;
            this.tip.y = 104;
            this.tip.x = w / 2 - 20;
            container.y = -50;
            container.x = 20;
            container.addChild(this.tip);
            container.addChild(this.rect);
            container.addChild(this.text);
            container.addChild(this.text1);

            roleGroup.addChild(container);
            this.stage.addChild(roleGroup);
        }
    }

    window.CarGame = CarGame;
})()
