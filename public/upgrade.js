(function(){
  var SAVEDKEY=KEY+"-saved-v1",CHATKEY=KEY+"-assistant-v1";
  var savedItems=JSON.parse(localStorage.getItem(SAVEDKEY)||"[]");
  var assistantMessages=JSON.parse(localStorage.getItem(CHATKEY)||"null")||[
    {role:"assistant",text:"你好，我是免费的本地行程助手。你可以问我当天安排、交通、穿搭和空档，也可以说“9月1日下午3点安排白沙古镇”，我会帮你加入时间线。"}
  ];
  var WEATHERKEY=KEY+"-hourly-weather-v2";
  var weatherCache=JSON.parse(localStorage.getItem(WEATHERKEY)||"{}");
  var weatherLoading={};
  var weatherPlaces={
    shenzhen:{name:"深圳",lat:22.54,lon:114.06},
    dali:{name:"大理·洱海东岸",lat:25.85,lon:100.31},
    lijiang:{name:"丽江",lat:26.87,lon:100.23},
    snow:{name:"玉龙雪山",lat:27.10,lon:100.18},
    shangri:{name:"香格里拉",lat:27.83,lon:99.70},
    meili:{name:"梅里·飞来寺",lat:28.44,lon:98.87},
    kunming:{name:"昆明",lat:25.04,lon:102.72}
  };
  var dayGuides={
    "8/30":{title:"抵达日 · 先稳妥到酒店",tips:["航班落地后预留约35分钟取行李","洱海东岸住宿较远，行李多时优先酒店接机或正规网约车","中巴班次与停靠点变化较大，上车前向机场服务台确认"],source:"https://map.baidu.com/"},
    "8/31":{title:"大理 → 丽江 · 少折返",tips:["挖色位于洱海东岸，优先询问酒店直送丽江或正规跨城车","如改乘动车，要额外预留前往大理站的时间","抵达丽江后先放行李，下午安排轻松活动"],source:"https://api.map.baidu.com/direction?origin=%E6%8C%96%E8%89%B2%E9%95%87&destination=%E4%B8%BD%E6%B1%9F%E5%8F%A4%E5%9F%8E&mode=driving&region=%E5%A4%A7%E7%90%86&output=html&src=webapp.mindy.yunnantrip"},
    "9/1":{title:"丽江慢游 · 顺路不折返",tips:["建议顺序：客栈 → 束河古镇 → 白沙古镇 → 客栈","束河至白沙距离较近，网约车通常比折返古城省时","白沙下午光线更柔和，晚餐可回古城南门附近"],source:"https://map.baidu.com/"},
    "9/2":{title:"玉龙雪山 · 2026 暑期重点",tips:["门票和环保车均为必选；门票100元/人、环保车20元/人","门票与索道均可提前7天实名预约；大索道以票面时段为准","景区5:45开放、16:30停止检票；关注官方天气与索道停运通知"],source:"https://www.yn.xinhuanet.com/20260718/f2d1560d5043462c9c5967496da38808/c.html"},
    "9/3":{title:"丽江 → 香格里拉 · 火车缓冲",tips:["C639 16:59出发，建议15:45前抵达丽江站","古城南门到丽江站建议预留30–45分钟并避开晚高峰","18:40到香格里拉后，优先网约车前往独克宗古城住宿"],source:"https://map.baidu.com/"},
    "9/4":{title:"松赞林寺 + 独克宗",tips:["上午先去松赞林寺，下午回独克宗古城和龟山公园","寺院内尊重礼仪，不对禁止拍摄区域拍照","香格里拉紫外线强、温差大，薄羽绒或冲锋衣随身带"],source:"https://xianggelila.gov.cn/zfxxgk_xglls/fdzdgknr/zzjg/t_xglls_szlsglj"},
    "9/5":{title:"普达措 · 留足整天",tips:["景区距香格里拉城区约22公里，官方当前参考开放时间8:00–16:30","门票与游览车合计参考138元/人，出发前再次核对公告","独克宗往返景区已有直通车，具体班次建议前一晚向游客中心确认"],source:"https://www.pdcuo.cn/"},
    "9/6":{title:"香格里拉 → 昆明 · 晚到",tips:["C88 17:25出发，建议16:20前到香格里拉站","22:04抵达昆明后不再排景点，直接入住休息","夜间出站人多，网约车请到平台指定上车点"],source:"https://map.baidu.com/"},
    "9/7":{title:"返程日 · 机场时间优先",tips:["CZ3452 17:40起飞，建议15:40前到达昆明长水机场","打车建议14:30前出发；地铁方案需额外预留换乘与步行时间","退房后把大件行李寄存在酒店，午餐安排在酒店附近"],source:"https://api.map.baidu.com/direction?origin=%E6%98%86%E6%98%8E%E7%AB%99&destination=%E6%98%86%E6%98%8E%E9%95%BF%E6%B0%B4%E5%9B%BD%E9%99%85%E6%9C%BA%E5%9C%BA&mode=transit&region=%E6%98%86%E6%98%8E&output=html&src=webapp.mindy.yunnantrip"}
  };

  function persistUpgrade(){
    localStorage.setItem(SAVEDKEY,JSON.stringify(savedItems));
    localStorage.setItem(CHATKEY,JSON.stringify(assistantMessages.slice(-30)));
    localStorage.setItem(PACKKEY,JSON.stringify(packingItems));
    localStorage.setItem(CHECKKEY,JSON.stringify(checked));
  }
  var legacySave=save;
  save=function(){
    legacySave();
    persistUpgrade();
  };

  (function runUrgentTripUpgrade(){
    var rev=KEY+"-departure-ready-v1";
    if(localStorage.getItem(rev)==="1")return;
    function day(date){return state.days.find(function(x){return x.date===date})}
    function add(date,event){
      var d=day(date);if(!d||d.events.some(function(x){return x.title===event.title}))return;
      d.events.push(event);
    }
    var first=day("8/30");
    if(first){
      first.events=first.events.filter(function(e){return !/^机场 → 酒店｜/.test(e.title)});
      first.events.forEach(function(e){if(e.kind==="住宿"&&e.time==="11:10")e.time="11:15"});
      add("8/30",{time:"04:40",end:"05:40",title:"抵达深圳宝安 T3 · 值机安检",kind:"交通",route:"出发地 → 深圳宝安国际机场 T3",booking:"国内航班建议起飞前2小时到达",note:"CZ5439 06:40起飞；南航柜台截止时间以当日航班动态为准，登机口通常会提前关闭",platform:"深圳机场官方",link:"https://www.szairport.com/szairport/cfzy/tiaoz.shtml"});
      add("8/30",{time:"10:20",end:"11:15",title:"大理机场 → 酒店｜交通二选一",kind:"交通",route:"推荐：酒店接机/正规网约车约40–55分钟；备选：下关—挖色中巴＋短途接驳约60–90分钟",cost:"打车估算 ¥80–120；中巴估算 ¥15–30/人",booking:"优先向酒店确认接机价；选择中巴时先向机场服务台确认班次与停靠点",note:"两种方案占用同一时段，不需要重复安排；行李多时推荐接机或网约车"});
    }
    add("9/3",{time:"15:25",end:"15:55",title:"丽江客栈 → 丽江站",kind:"交通",route:"推荐网约车，目标15:55前抵达车站",booking:"C639 16:59开车，预留约1小时进站、安检与候车",note:"车站会提前停止检票，具体时间以12306和站内提示为准",platform:"铁路12306",link:"https://kyfw.12306.cn/otn/gonggao/enterAndExit.html"});
    add("9/6",{time:"15:45",end:"16:20",title:"香格里拉民宿 → 香格里拉站",kind:"交通",route:"推荐网约车，目标16:20前抵达车站",booking:"C88 17:25开车，预留约1小时进站、安检与候车",note:"车站会提前停止检票，具体时间以12306和站内提示为准",platform:"铁路12306",link:"https://kyfw.12306.cn/otn/gonggao/enterAndExit.html"});
    add("9/7",{time:"14:30",end:"15:40",title:"昆明酒店 → 长水机场",kind:"交通",route:"推荐网约车；备选地铁需额外预留换乘和步行时间",booking:"CZ3452 17:40起飞，目标15:40前到达；昆明机场国内值机通常提前40分钟截止",note:"值机后直接安检，登机口通常会在起飞前20分钟关闭；以当日航班动态为准",platform:"昆明机场官方",link:"https://www.ynairport.com/cnkunming/index.jhtml"});
    state.days.forEach(function(d){d.events.sort(function(a,b){return String(a.time).localeCompare(String(b.time))})});
    [
      {id:"curated-dy-dali-lijiang",platform:"抖音",title:"大理＋丽江 5天4晚路线灵感",link:"https://jingxuan.douyin.com/m/video/7650508016051064104",note:"公开可打开的路线视频；用于调整顺路景点，价格与开放信息请在出发前复核。"},
      {id:"curated-dy-yulong",platform:"抖音",title:"玉龙雪山 9月交通与费用参考",link:"https://www.douyin.com/video/7418165672259226907?source=Baiduspider-sdc",note:"重点参考101路与交通思路；票务、索道时段以官方预约页和当天公告为准。"},
      {id:"curated-dy-shangri",platform:"抖音",title:"香格里拉两日路线灵感",link:"https://jingxuan.douyin.com/m/video/7485760827295943990",note:"可用于9月4日至5日取舍；高原天气与景区开放情况需当天确认。"}
    ].forEach(function(item){if(!savedItems.some(function(x){return x.id===item.id||x.link===item.link}))savedItems.push(item)});
    localStorage.setItem(rev,"1");save();
  })();

  function runUserWishListUpgrade(){
    var rev=KEY+"-baisha-wase-shangri-v1";
    if(localStorage.getItem(rev)==="1")return;
    function day(date){return state.days.find(function(x){return x.date===date})}
    function remove(date,titles){var d=day(date);if(d)d.events=d.events.filter(function(e){return !titles.some(function(t){return t instanceof RegExp?t.test(e.title):e.title===t})})}
    function add(date,event){var d=day(date);if(d&&!d.events.some(function(e){return e.title===event.title}))d.events.push(event)}
    function find(date,test){var d=day(date);return d&&d.events.find(test)}

    remove("8/30",["双廊古镇 · 玉几岛沿海慢拍","双廊早晚餐＋洱海日落","双廊 → 挖色酒店"]);
    add("8/30",{time:"15:00",end:"16:20",title:"双廊古镇 · 临水街巷慢拍",kind:"景点",route:"双廊南门 → 主街支巷 → 玉几岛沿海步道",note:"先拍小巷、门洞和临水街景，把最好看的洱海光线留给傍晚咖啡；浅色或低饱和穿搭更出片"});
    add("8/30",{time:"16:30",end:"19:35",title:"WUJI CAFE · 270°洱海落日拍照",kind:"咖啡",route:"双廊观景区内，步行或短途接驳前往；17:30后光线更柔",booking:"出发前在平台确认当天营业、低消、预约与座位规则",note:"主打拍照和落日氛围，不把正餐押在咖啡店；若阴雨则提前结束去吃饭",platform:"抖音公开推荐",link:"https://jingxuan.douyin.com/m/video/7635313266427743497"});
    add("8/30",{time:"19:45",end:"20:45",title:"双廊晚餐 · 经济半小食",kind:"美食",route:"民族文化街玉几岛入口附近，选酸汤鱼、水性杨花、白族家常菜",booking:"公开页面评价量不大，现场先看菜单与明码标价；若更在意环境，可把格外小馆作为高预算备选",note:"落日后再吃正餐；如果第一天太累，可将晚餐提前并缩短咖啡时间",platform:"携程美食",link:"https://gs.ctrip.com/html5/you/foods/fooddetail/1445616/7267293.html"});
    add("8/30",{time:"20:55",end:"21:40",title:"双廊 → 挖色酒店",kind:"交通",route:"使用提前约好的正规网约车或酒店车辆",note:"不要到散场后再临时找车；上车前核对车牌和目的地"});

    remove("8/31",["海景早餐 · 慢慢醒","挖色码头与湖边散步","回酒店整理与退房"]);
    add("8/31",{time:"08:10",end:"08:40",title:"酒店早餐 · 轻装出门",kind:"美食",note:"行李先留在酒店，只带手机、相机、防晒和水"});
    add("8/31",{time:"08:45",end:"10:50",title:"挖色轻环线 · 鹿卧山安全观景位 → 挖色码头 → 小普陀",kind:"景点",route:"请酒店叫正规车辆，按酒店位置让司机优化顺序；各点短停拍照，不走野路",booking:"与司机约好全程等候或分段价格，10:50前必须返酒店",note:"鹿卧山只在公路安全观景位拍，不下野坡或洞穴；8月底小普陀通常没有冬季海鸥，重点拍岛、湖面和公路感",platform:"挖色公开攻略",link:"https://jp.trip.com/moments/theme/poi-wa-se-pier-93763107-guides-993135/"});
    add("8/31",{time:"10:50",end:"12:00",title:"回酒店整理与退房",kind:"住宿",note:"12:00退房；让酒店提前约好13:15前往丽江的正规跨城车"});

    remove("9/1",["丽江客栈 → 白沙古镇","白沙古镇 · 雪山街景与慢拍","白沙午餐","白沙 → 束河古镇","束河古镇 · 茶马古道慢游","束河 → 丽江客栈"]);
    add("9/1",{time:"09:00",end:"09:30",title:"丽江客栈 → 束河古镇",kind:"交通",route:"正规网约车到束河北门或停车点；上午先走束河，再一路向北去白沙"});
    add("9/1",{time:"09:30",end:"11:35",title:"束河古镇 · 青龙桥与九鼎龙潭",kind:"景点",route:"北门附近 → 青龙桥 → 九鼎龙潭 → 安静支巷",note:"只走精华小环线，不把两个古镇都逛成暴走"});
    add("9/1",{time:"11:35",end:"12:10",title:"束河 → 缓山私厨",kind:"交通",route:"正规网约车前往白沙镇三元村，给找院门和堵车留缓冲"});
    add("9/1",{time:"12:15",end:"13:45",title:"缓山私厨·庭院餐厅（白沙古镇店）",kind:"美食",route:"玉龙县白沙镇白沙村委会三元村一组33号后院",booking:"电话 13888400152；建议提前联系确认营业与订位",note:"这是你指定想吃的店；地址、电话来自你分享的美团卡片，出发前再在美团核对一次",platform:"美团",link:"http://dpurl.cn/W7qyT4Tz"});
    add("9/1",{time:"13:45",end:"14:20",title:"白沙古镇 · 午后慢拍",kind:"景点",route:"餐厅 → 白沙主街 → 安静巷道",note:"给手作前留一点拍照和散步时间，不额外绕远"});
    add("9/1",{time:"14:30",end:"17:00",title:"白沙植物拓染 · 敲敲打一下午",kind:"手作",booking:"先用小红书原帖联系作者或店家，确认店名、地址、时长、价格和是否预约",note:"你分享的短链在公开网页暂时无法展开，所以先按白沙古镇手作安排；确认店名后可直接在工作台编辑详情",platform:"小红书",link:"https://xhslink.cn/o/77hUBQRnj6J"});
    add("9/1",{time:"17:00",end:"18:05",title:"白沙古镇 · 雪山街景与傍晚光线",kind:"景点",route:"白沙牌坊 → 主街 → 能看到雪山的开阔位置",note:"手作结束后直接在白沙补拍；云多就喝咖啡，不为单一机位等待"});
    add("9/1",{time:"18:10",end:"18:50",title:"白沙 → 丽江客栈",kind:"交通",route:"正规网约车返回；晚餐和夜间安排自由"});

    remove("9/2",["丽江客栈 → 玉龙雪山","入园核验与换乘观光车"]);
    add("9/2",{time:"05:10",end:"06:20",title:"丽江客栈 → 甘海子日照金山观景区",kind:"交通",route:"前一晚约好正规包车或可靠小团；不依赖首班101路",booking:"前一晚确认景区早间开放、车辆进入规则和集合点；若甘海子暂未开放，改去司机确认可达的东巴谷或黑龙潭安全观景位",note:"目标日出前30分钟以上到位；9月2日日出参考约06:58，实际以天气页和当天云量为准",platform:"玉龙雪山官方信息",link:"https://www.yn.xinhuanet.com/20260427/056b9de46d7e422992c1aa13d7a4b773/c.html"});
    add("9/2",{time:"06:20",end:"07:30",title:"甘海子 · 等日照金山",kind:"景点",route:"选择无遮挡、安全且不影响交通的观景位置",note:"经典“日照金山”是日出第一束光照亮雪峰；日落可能出现粉金晚霞，但不是同一种效果。能否看到取决于雪峰与东方天空云层"});
    add("9/2",{time:"07:30",end:"08:20",title:"早餐、入园核验与换乘观光车",kind:"交通",route:"简单补充热食和水 → 身份证核验门票 → 按索道预约时段候乘",note:"大索道仍严格以票面时段为准；若预约时段不同，后续行程顺延"});

    remove("9/4",["早餐与高原状态检查","民宿 → 香格里拉客运站","客运站 → 普达措","普达措国家公园 · 留足一整段","普达措 → 香格里拉城区","回民宿休息","独克宗古城与龟山公园夜景"]);
    remove("9/5",["梅里天气闸门 · 二选一","天气二选一｜A飞来寺 / B松赞林寺＋纳帕海","A线飞来寺入住 / B线古城晚餐"]);
    remove("9/6",["A线日照金山＋返程 / B线香格里拉慢早晨","午餐、取行李与退房"]);
    add("9/4",{time:"08:30",end:"09:10",title:"早餐与高原状态检查",kind:"美食",note:"第一天不赶早；若头痛、恶心明显，减少步行并优先休息"});
    add("9/4",{time:"09:15",end:"09:45",title:"独克宗民宿 → 松赞林寺",kind:"交通",route:"正规网约车或景区直通车，按当天交通选择"});
    add("9/4",{time:"09:45",end:"12:00",title:"松赞林寺 · 上午慢游",kind:"景点",route:"景区车 → 主寺 → 观景位，台阶处慢走",note:"尊重寺院礼仪和禁拍区域；高原第一天不追求走满每个角落"});
    add("9/4",{time:"12:10",end:"13:10",title:"松赞林寺附近午餐",kind:"美食",note:"吃热食、补水，避免饮酒和过饱"});
    add("9/4",{time:"13:30",end:"17:20",title:"纳帕海半环湖 · 草原与村落慢拍",kind:"景点",route:"使用正规包车或景区直通服务，按路况选择安全停车点，不骑电动车环湖",booking:"提前确认包车等候、停车和返程价格",note:"把拍照、喝咖啡和发呆都放在这一段；遇雨缩短环线，路边不随意停车",platform:"迪庆州政府·景区直通车",link:"https://www.diqing.gov.cn/xwzx/xsqkx/202408/20240830_215419.html"});
    add("9/4",{time:"17:30",end:"19:00",title:"回民宿休息",kind:"其他",note:"洗澡、补水、整理照片，高原行程不要连轴转"});
    add("9/4",{time:"19:00",end:"20:30",title:"独克宗古城 · 晚餐与龟山夜景",kind:"逛吃",route:"民宿步行 → 月光广场 → 龟山公园 → 古城支巷",note:"转经筒和台阶都量力而行，累了随时回住处"});
    add("9/5",{time:"07:45",end:"08:20",title:"早餐与普达措出发准备",kind:"美食",note:"带雨衣、保温杯、能量食品，穿防滑鞋"});
    add("9/5",{time:"08:20",end:"09:00",title:"香格里拉城区 → 普达措",kind:"交通",route:"优先提前买客运站或景区直通车票；官方参考车程约30分钟",platform:"普达措官网",link:"https://www.pdcuo.cn/"});
    add("9/5",{time:"09:00",end:"15:00",title:"普达措国家公园 · 属都湖慢走",kind:"景点",route:"景区车＋当天开放步道为主，不追求每一段都走满",cost:"官网当前参考门票＋游览车 ¥138/人",booking:"提前购票并确认当天开放区域与返程班次",note:"慢走、不奔跑；下雨或身体不适时缩短步道，15:00左右返程更松弛",platform:"普达措官网",link:"https://www.pdcuo.cn/"});
    add("9/5",{time:"15:00",end:"15:45",title:"普达措 → 香格里拉城区",kind:"交通",route:"按已确认的返程班车返回，避免错过末班"});
    add("9/5",{time:"16:10",end:"18:10",title:"民宿休息 · 留白",kind:"其他",note:"这是高原恢复时间；天气好也不临时加远途景点"});
    add("9/5",{time:"18:30",end:"20:30",title:"独克宗晚餐与自由散步",kind:"逛吃",note:"可补拍夜景或早点回房，为第二天高铁留体力"});
    add("9/6",{time:"09:00",end:"10:00",title:"睡到自然醒 · 古城早餐",kind:"美食",note:"不再从梅里清晨赶回，最后半天保留确定性"});
    add("9/6",{time:"10:00",end:"12:00",title:"独克宗白天补拍＋咖啡",kind:"景点",route:"月光广场 → 古城支巷 → 咖啡馆",note:"白天与夜晚氛围不同；若高反或下雨，直接在咖啡馆休息"});
    add("9/6",{time:"12:00",end:"14:10",title:"午餐、取行李与退房",kind:"其他",note:"吃一顿热食并整理行李；14:10前结束，给车站交通留足缓冲"});
    var station=find("9/6",function(e){return e.title==="香格里拉民宿 → 香格里拉站"});if(station)station.note="15:45准时出发，不临时加远途项目；停止检票时间以12306和站内提示为准";
    var stay5=find("9/5",function(e){return e.kind==="住宿"});if(stay5)stay5.note=String(stay5.note||"").replace(/；主行李保留在香格里拉.*$/,"");

    dayGuides["8/30"]={title:"双廊 · 把最好光线留给落日咖啡",tips:["15点后再进双廊，先拍街巷，再去WUJI CAFE等柔光和落日","咖啡店是拍照主场，正餐安排在落日后；太累就提前吃饭","返程车辆出发前约好，21点左右离开不临时找车"],source:"https://jingxuan.douyin.com/m/video/7635313266427743497"};
    dayGuides["8/31"]={title:"挖色轻环线 → 丽江",tips:["只带随身物品走鹿卧山安全观景位、挖色码头和小普陀","鹿卧山不下野坡；8月底小普陀不要期待冬季海鸥","10:50回酒店整理，午饭后直达丽江，下午不再加绕路景点"],source:"https://jp.trip.com/moments/theme/poi-wa-se-pier-93763107-guides-993135/"};
    dayGuides["9/1"]={title:"束河 → 白沙 · 手作治愈日",tips:["上午用两个小时走束河精华，中午到白沙吃你指定的缓山私厨","14:30把完整下午留给植物拓染，店名与预约细节需从小红书原帖确认","手作结束后直接在白沙等柔光，不再来回折返"],source:"https://xhslink.cn/o/77hUBQRnj6J"};
    dayGuides["9/2"]={title:"玉龙雪山 · 日出金山优先",tips:["经典日照金山是日出第一束光，9月2日日出参考约06:58，05:10左右从丽江出发","主选甘海子，因为能和当天雪山行程衔接；前一晚必须确认早间开放与车辆进入规则","若甘海子不可达，改东巴谷或黑龙潭安全观景位；云层过厚就不要为机位冒险"],source:"https://www.yn.xinhuanet.com/20260427/056b9de46d7e422992c1aa13d7a4b773/c.html"};
    dayGuides["9/4"]={title:"松赞林寺 → 纳帕海 · 一条清楚主线",tips:["上午松赞林寺，下午包车半环纳帕海，避免古城与远郊来回穿插","纳帕海不骑电动车环湖，正规车辆、短停慢拍更安全也更松弛","傍晚回民宿休息后再逛独克宗夜景"],source:"https://www.diqing.gov.cn/xwzx/xsqkx/202408/20240830_215419.html"};
    dayGuides["9/5"]={title:"普达措 · 单独留足一天",tips:["官网当前参考8:00开放、16:30闭园，提前确认往返班次","以属都湖和当天开放区域为主，不追求把每段步道走满","梅里若仍想赌晴窗，必须整天替换本日并另订飞来寺住宿，不能与普达措同时完成"],source:"https://www.pdcuo.cn/"};
    dayGuides["9/6"]={title:"香格里拉最后半天 → C88",tips:["睡到自然醒，白天补拍独克宗并留咖啡时间","12点后只吃饭、整理和退房，不再跑纳帕海或梅里","15:45从民宿出发，目标16:20前到香格里拉站"],source:"https://kyfw.12306.cn/otn/gonggao/enterAndExit.html"};

    [
      {id:"wish-xhs-baisha-rubbing",platform:"小红书",title:"白沙古镇 · 植物拓染体验",link:"https://xhslink.cn/o/77hUBQRnj6J",note:"你分享的治愈手作。公开短链暂时无法展开，需在小红书内确认店名、地址、价格和预约方式。"},
      {id:"wish-mt-huanshan",platform:"美团",title:"缓山私厨·庭院餐厅（白沙古镇店）",link:"http://dpurl.cn/W7qyT4Tz",note:"地址：玉龙县白沙镇白沙村委会三元村一组33号后院；电话：13888400152。来自你分享的美团卡片。"},
      {id:"wish-dy-wuji",platform:"抖音",title:"WUJI CAFE · 双廊270°洱海落日",link:"https://jingxuan.douyin.com/m/video/7635313266427743497",note:"建议16:30后到，17:30—日落是重点拍照时段；营业、低消与预约以当天平台为准。"},
      {id:"wish-ctrip-shuanglang-food",platform:"其他",title:"经济半小食 · 双廊白族家常菜",link:"https://gs.ctrip.com/html5/you/foods/fooddetail/1445616/7267293.html",note:"落日后的正餐备选，公开评价量不大，到店先看明码标价与当日菜单。"},
      {id:"wish-meili-optional",platform:"攻略",title:"梅里日照金山 · 只作为整日替换方案",link:"https://www.diqing.gov.cn/xwzx/xsqkx/202408/20240830_215419.html",note:"若决定去，需用9月5日整天前往飞来寺并另住一晚，9月6日看完日出立即返香格里拉；会牺牲普达措且增加赶C88风险。"}
    ].forEach(function(item){if(!savedItems.some(function(x){return x.id===item.id||x.link===item.link}))savedItems.push(item)});

    state.days.forEach(function(d){d.events.sort(function(a,b){return String(a.time).localeCompare(String(b.time))})});
    localStorage.setItem(rev,"1");save();
  }

  (function runDetailedItineraryUpgrade(){
    var rev=KEY+"-relaxed-detailed-plan-v1";
    if(localStorage.getItem(rev)==="1")return;
    function day(date){return state.days.find(function(x){return x.date===date})}
    function remove(date,titles){var d=day(date);if(d)d.events=d.events.filter(function(e){return !titles.some(function(t){return t instanceof RegExp?t.test(e.title):e.title===t})})}
    function add(date,event){var d=day(date);if(d&&!d.events.some(function(e){return e.title===event.title}))d.events.push(event)}
    function find(date,test){var d=day(date);return d&&d.events.find(test)}

    remove("8/31",["大理退房与洱海晨景","前往丽江"]);
    remove("9/1",["束河古镇","白沙古镇"]);
    remove("9/3",["丽江客栈 → 丽江站"]);
    remove("9/4",["松赞林寺","独克宗古城与龟山公园"]);
    remove("9/5",["普达措国家公园"]);
    remove("9/6",["香格里拉民宿 → 香格里拉站"]);
    remove("9/7",["昆明酒店 → 长水机场"]);

    add("8/30",{time:"11:15",end:"14:00",title:"酒店安顿＋午餐＋补觉",kind:"其他",route:"入住或先寄存行李 → 酒店附近吃白族家常菜",note:"第一天凌晨出发，不安排远距离景点；至少休息1小时再出门"});
    add("8/30",{time:"14:10",end:"15:00",title:"挖色酒店 → 双廊古镇",kind:"交通",route:"推荐正规网约车或请酒店叫车；直接到双廊古镇南门",note:"返程车提前约好，避免晚间临时等车"});
    add("8/30",{time:"15:00",end:"17:45",title:"双廊古镇 · 玉几岛沿海慢拍",kind:"景点",route:"南门 → 主街小巷 → 玉几岛沿海步道 → 临水咖啡",booking:"太阳宫等室内点位若想进入需单独查看预约；不把它设为必去",note:"下午光线逐渐柔和；白裙、浅色或低饱和穿搭更衬洱海，石板路建议穿好走的鞋",platform:"云南乡村旅游官方资料",link:"https://www.ynxc.gov.cn/uploadfile/s61/2024/0419/20240419094718599.pdf"});
    add("8/30",{time:"17:45",end:"19:25",title:"双廊早晚餐＋洱海日落",kind:"美食",route:"选择能步行到水边的餐厅，饭后到沿海步道等日落",note:"推荐点白族酸辣鱼、水性杨花、老奶洋芋；景观餐厅先看明码标价，不为机位排长队"});
    add("8/30",{time:"19:30",end:"20:10",title:"双廊 → 挖色酒店",kind:"交通",route:"使用提前约好的正规网约车/酒店车辆",note:"回酒店后不再排项目，洗澡休息"});

    add("8/31",{time:"08:30",end:"09:20",title:"海景早餐 · 慢慢醒",kind:"美食",note:"不赶日出；在酒店吃早餐、整理当天照片"});
    add("8/31",{time:"09:30",end:"10:35",title:"挖色码头与湖边散步",kind:"景点",route:"从酒店短途打车或步行至挖色水岸；时间充足再远眺小普陀",note:"这是退房前最顺路的轻量安排；不建议拖着行李再绕去喜洲或沙溪"});
    add("8/31",{time:"10:35",end:"12:00",title:"回酒店整理与退房",kind:"住宿",note:"12:00退房；让酒店提前约好前往丽江的正规车辆"});
    add("8/31",{time:"12:00",end:"13:05",title:"挖色午餐",kind:"美食",note:"以清淡、出菜快为主，13:15准时出发；晕车者饭后不要吃太撑"});
    add("8/31",{time:"13:15",end:"16:15",title:"挖色 → 丽江古城南门",kind:"交通",route:"推荐正规平台跨城车/酒店代约车直达客栈；预计约2.5–3小时，以百度地图实时路况为准",booking:"出发前确认是否含高速费、等候费以及古城限行后的下车点",note:"这段直接走最松弛；沙溪、喜洲都不是顺手的两小时加项，不建议硬塞"});
    add("8/31",{time:"17:30",end:"21:30",title:"丽江古城第一夜 · 一路慢逛",kind:"逛吃",route:"南门 → 七一街 → 木府外街巷 → 四方街 → 大水车；累了可从北门打车回客栈",note:"18点左右先吃晚餐，天黑后看灯景；主街拥挤时钻进支巷，不追网红店排队"});
    var ljHotel=find("8/31",function(e){return e.kind==="住宿"});if(ljHotel)ljHotel.time="16:20";

    add("9/1",{time:"09:00",end:"09:40",title:"丽江客栈 → 白沙古镇",kind:"交通",route:"网约车约30–40分钟；先去更远的白沙，再一路向南回束河",note:"这种顺序比先束河再折返白沙更省路"});
    add("9/1",{time:"09:40",end:"12:15",title:"白沙古镇 · 雪山街景与慢拍",kind:"景点",route:"白沙牌坊 → 主街 → 安静巷道 → 看得到雪山的咖啡露台",note:"上午光线较柔，先拍照后喝咖啡；是否进入白沙壁画景区按兴趣决定，不强塞"});
    add("9/1",{time:"12:15",end:"13:30",title:"白沙午餐",kind:"美食",note:"可试纳西烤肉、鸡豆凉粉或米线；下午还要走路，吃七分饱"});
    add("9/1",{time:"13:30",end:"14:00",title:"白沙 → 束河古镇",kind:"交通",route:"正规网约车短途直达束河北门或停车点"});
    add("9/1",{time:"14:00",end:"17:30",title:"束河古镇 · 茶马古道慢游",kind:"景点",route:"北门附近 → 青龙桥 → 九鼎龙潭 → 四方听音一带",note:"束河比大研古城安静，下午安排咖啡和发呆时间，不再加玉湖村"});
    add("9/1",{time:"17:30",end:"18:10",title:"束河 → 丽江客栈",kind:"交通",route:"网约车返回；晚上自由休息或再去古城吃饭"});

    add("9/3",{time:"08:30",end:"09:20",title:"早餐＋整理行李",kind:"美食",note:"退房后把大件行李寄存在客栈，轻装逛半天"});
    add("9/3",{time:"09:30",end:"11:25",title:"忠义市场 → 木府外 → 七一街",kind:"逛吃",route:"从古城南门附近步行串联，避免上午跑到城北再折返",note:"逛市场、买小吃、补拍白天古城；若第一晚已逛够，就改成咖啡馆休息"});
    add("9/3",{time:"11:30",end:"12:35",title:"丽江午餐",kind:"美食",note:"选择古城南门或客栈附近，方便回去取行李；可试腊排骨小锅或纳西炒饭"});
    add("9/3",{time:"12:35",end:"14:40",title:"退房寄存＋咖啡休息",kind:"其他",note:"给高铁前留一段真正空白，不再塞景点"});
    add("9/3",{time:"14:40",end:"15:55",title:"取行李 → 丽江站",kind:"交通",route:"客栈取行李后网约车去丽江站，目标15:55前抵达",booking:"C639 16:59开车，预留约1小时进站、安检与候车",note:"具体停止检票时间以12306和站内提示为准",platform:"铁路12306",link:"https://kyfw.12306.cn/otn/gonggao/enterAndExit.html"});
    add("9/3",{time:"20:00",end:"21:30",title:"独克宗古城 · 牦牛肉火锅",kind:"美食",route:"办理入住后步行前往古城内明码标价的火锅店",note:"第一晚海拔适应优先：少酒、慢吃、多喝水，不要一到高原就剧烈活动"});

    add("9/4",{time:"07:30",end:"08:05",title:"早餐与高原状态检查",kind:"美食",note:"如果头痛、恶心明显，取消整日景区；普达措平均海拔较高"});
    add("9/4",{time:"08:05",end:"08:30",title:"民宿 → 香格里拉客运站",kind:"交通",route:"网约车前往客运站，赶8:30左右班车"});
    add("9/4",{time:"08:30",end:"09:00",title:"客运站 → 普达措",kind:"交通",route:"官方信息显示每日有多班车，单程约30分钟、参考¥15；以当天售票为准",platform:"普达措官网",link:"https://www.pdcuo.cn/"});
    add("9/4",{time:"09:00",end:"15:00",title:"普达措国家公园 · 留足一整段",kind:"景点",route:"景区车＋属都湖步道为主，开放区域按当天公告",cost:"官网参考门票＋游览车 ¥138/人",booking:"建议提前购票并确认当天开放区域",note:"慢走、不奔跑；备雨衣、保温杯和能量食品。15:00左右乘班车返回较松弛",platform:"普达措官网",link:"https://www.pdcuo.cn/"});
    add("9/4",{time:"15:00",end:"15:40",title:"普达措 → 香格里拉城区",kind:"交通",route:"按返程班车时刻返回，错过班车则正规平台叫车"});
    add("9/4",{time:"16:00",end:"18:10",title:"回民宿休息",kind:"其他",note:"洗澡、补水、整理照片；高原行程不连轴转"});
    add("9/4",{time:"18:30",end:"20:30",title:"独克宗古城与龟山公园夜景",kind:"景点",route:"民宿步行 → 龟山公园 → 月光广场 → 古城小巷",note:"量力参与转经筒；台阶处慢走，累了随时回民宿"});
    var stay4=find("9/4",function(e){return e.kind==="住宿"});if(stay4)stay4.time="20:30";

    add("9/5",{time:"07:30",end:"08:10",title:"梅里天气闸门 · 二选一",kind:"提醒",booking:"查看“天气”页的梅里·飞来寺：重点看9月6日06:00–08:00云量、降水和能见度",note:"A线只在有晴窗且已落实可靠车辆、可退飞来寺住宿时成行；否则走B线。8月26日初报云雨风险高，暂不建议押不可退订单"});
    add("9/5",{time:"08:30",end:"17:00",title:"天气二选一｜A飞来寺 / B松赞林寺＋纳帕海",kind:"景点",route:"A线：纳帕海短停 → 奔子栏午餐 → 金沙江大拐弯 → 飞来寺；B线：松赞林寺 → 午餐 → 纳帕海半环湖慢游",booking:"A线需提前落实正规包车/小团和飞来寺可退住宿；B线可使用景区直通车或正规网约车",note:"A线约4小时以上山路且次日要赶高铁，是全程唯一偏紧段；B线明显更松弛。不要骑电动车环纳帕海，雨季与大车路段安全优先",platform:"迪庆州政府·景区直通车",link:"https://www.diqing.gov.cn/xwzx/xsqkx/202408/20240830_215419.html"});
    add("9/5",{time:"17:00",end:"19:30",title:"A线飞来寺入住 / B线古城晚餐",kind:"其他",route:"A线：飞来寺观景酒店办理入住、踩好次日日出机位；B线：返回独克宗吃饭休息",note:"A线只带一晚小包，主行李继续放在香格里拉酒店；飞来寺住宿优先选可免费取消"});
    var stay5=find("9/5",function(e){return e.kind==="住宿"});if(stay5)stay5.note=(stay5.note?stay5.note+"；":"")+"主行李保留在香格里拉；若走梅里A线，当晚另住飞来寺并保留本房方便次日返回整理";

    add("9/6",{time:"06:35",end:"12:30",title:"A线日照金山＋返程 / B线香格里拉慢早晨",kind:"景点",route:"A线：06:35到观景位 → 约07:05日出 → 07:40前后返香格里拉；B线：睡到自然醒 → 古城早餐 → 松赞林寺或咖啡馆补漏",booking:"A线必须使用能确保中午前回到香格里拉的可靠车辆，并准备因道路天气取消",note:"A线目标12:30前回到酒店；若9月5日晚仍持续降雨或低云，直接放弃日照金山，不赌赶不上C88"});
    add("9/6",{time:"12:30",end:"14:10",title:"午餐、取行李与退房",kind:"其他",note:"回酒店洗漱整理；最晚14:10前结束，给车站交通留缓冲"});
    add("9/6",{time:"15:45",end:"16:20",title:"香格里拉民宿 → 香格里拉站",kind:"交通",route:"推荐网约车，目标16:20前抵达车站",booking:"C88 17:25开车，预留约1小时进站、安检与候车",note:"如果走梅里A线，任何道路延误都以不影响火车为最高优先级",platform:"铁路12306",link:"https://kyfw.12306.cn/otn/gonggao/enterAndExit.html"});

    var kmStay=find("9/7",function(e){return e.kind==="住宿"});if(kmStay){kmStay.time="08:30";kmStay.title="昆明酒店退房 · 行李随车";kmStay.note="建议预约正规半日送机车，把酒店—斗南—机场串成单向路线，避免拖行李换乘"}
    add("9/7",{time:"09:10",end:"11:40",title:"斗南花卉市场 · 鲜花与手作",kind:"景点",route:"昆明站附近酒店 → 斗南花市；建议半日送机车或正规网约车",note:"先逛鲜切花与干花手作，再买易携带的小束；购买前问清包装和乘机携带方式",platform:"云南网·昆明文旅信息",link:"https://kunming.yunnan.cn/system/2026/04/16/033968659.shtml"});
    add("9/7",{time:"11:40",end:"12:45",title:"斗南附近午餐",kind:"美食",note:"不再横跨城区去网红店；吃米线、汽锅鸡简餐或菌菇饭，给机场留足时间"});
    add("9/7",{time:"12:45",end:"14:00",title:"花市咖啡＋整理花束",kind:"其他",note:"最后一段留白；如果不想带花或下雨，改成室内慢逛"});
    add("9/7",{time:"14:10",end:"15:10",title:"斗南花市 → 昆明长水机场",kind:"交通",route:"推荐正规送机车/网约车，目标15:10左右到机场；实时路况优先",booking:"CZ3452 17:40起飞；昆明机场国内值机通常提前40分钟截止",note:"比最低安全线再多留约30分钟，花束和行李较多时更从容",platform:"昆明机场官方",link:"https://www.ynairport.com/cnkunming/index.jhtml"});

    dayGuides["8/30"]={title:"双廊出片 · 下午再出发",tips:["凌晨赶飞机后先在酒店午餐和补觉，15点左右到双廊正好避开正午硬光","主拍玉几岛沿海步道、小巷门洞、临水咖啡；不为单一网红机位长时间排队","返程车提前约好，日落后直接回挖色休息"],source:"https://www.ynxc.gov.cn/uploadfile/s61/2024/0419/20240419094718599.pdf"};
    dayGuides["8/31"]={title:"挖色 → 丽江 · 只加一个顺路点",tips:["上午只逛酒店附近挖色水岸，12点退房吃午饭后直接跨城","喜洲和沙溪都会明显绕路，不适合拖着行李临时加进去","丽江第一晚走南门到大水车单向慢逛，累了从北门打车回酒店"],source:"https://map.baidu.com/"};
    dayGuides["9/1"]={title:"白沙 → 束河 · 由远及近",tips:["先去更远的白沙，午饭后南下束河，路线比反向折返更顺","白沙主打雪山街景和咖啡，束河主打青龙桥、九鼎龙潭与安静小巷","不再加玉湖村，把一天控制在两个古镇"],source:"https://map.baidu.com/"};
    dayGuides["9/3"]={title:"丽江最后半天 · 酒店周边解决",tips:["只走忠义市场、木府外街巷和七一街，方便随时回客栈取行李","14:40开始往丽江站移动，目标15:55前到站","到香格里拉后先入住再吃牦牛肉火锅，第一晚不饮酒、不剧烈活动"],source:"https://kyfw.12306.cn/otn/gonggao/enterAndExit.html"};
    dayGuides["9/4"]={title:"普达措 · 单独留一天",tips:["官网当前参考8:00开放、16:30闭园，城区客运站有多班往返车","路线以属都湖和当天开放区域为准，不追求把每一段步道走满","下午回酒店休息两小时，晚上再慢逛独克宗"],source:"https://www.pdcuo.cn/"};
    dayGuides["9/5"]={title:"梅里只在晴窗成行",tips:["A线覆盖纳帕海短停、G214沿途和飞来寺过夜；B线留在香格里拉走松赞林寺＋纳帕海","8月26日模型初报9月6日清晨云雨风险高，先订可退房，不押不可退小团","9月3日晚和9月5日早晨分别复核一次梅里天气，阴雨直接走B线"],source:"https://www.diqing.gov.cn/xwzx/xsqkx/202408/20240830_215419.html"};
    dayGuides["9/6"]={title:"日照金山不能影响C88",tips:["A线约07:05看日出后立即返香格里拉，目标12:30前回酒店","如果道路、车辆或天气任何一项不稳，放弃梅里并走B线慢早晨","无论哪条线，15:45从民宿出发去车站，16:20前到站"],source:"https://kyfw.12306.cn/otn/gonggao/enterAndExit.html"};
    dayGuides["9/7"]={title:"斗南 → 机场 · 单向不折返",tips:["预约正规半日送机车，退房后行李随车，酒店—斗南—机场一路向前","斗南留约2.5小时已足够买花、拍照和看手作，不再硬塞昆明老街","若不想带行李逛花市，可整段替换为昆明老街—文庙直街—文明街Citywalk"],source:"https://kunming.yunnan.cn/system/2026/04/16/033968659.shtml"};

    state.days.forEach(function(d){d.events.sort(function(a,b){return String(a.time).localeCompare(String(b.time))})});
    localStorage.setItem(rev,"1");save();
  })();

  runUserWishListUpgrade();

  (function runBaishaGuideSaveUpgrade(){
    var rev=KEY+"-baisha-five-days-guide-v1";
    if(localStorage.getItem(rev)==="1")return;
    var item={
      id:"wish-xhs-baisha-five-days",
      platform:"小红书",
      title:"白沙古镇 · 住了5天后的8小时逛吃玩攻略",
      link:"https://xhslink.cn/o/3FlzYE7ylvz",
      note:"你分享的白沙深度攻略，先作为选店、机位和小店灵感收藏；当前9月1日仍按束河—缓山私厨—植物拓染—白沙傍晚的松弛主线执行。"
    };
    if(!savedItems.some(function(x){return x.id===item.id||x.link===item.link}))savedItems.push(item);
    localStorage.setItem(rev,"1");save();
  })();

  (function runTicketedYulongPlanUpgrade(){
    var rev=KEY+"-ticketed-yulong-swiss-garden-v1";
    if(localStorage.getItem(rev)==="1")return;
    var d=state.days.find(function(x){return x.date==="9/2"});
    if(!d)return;
    var replaced=[
      "丽江客栈 → 甘海子日照金山观景区",
      "甘海子 · 等日照金山",
      "早餐、入园核验与换乘观光车",
      "冰川公园大索道与雪山栈道",
      "游客中心午餐与休息",
      "蓝月谷",
      "玉龙雪山 → 丽江客栈"
    ];
    d.events=d.events.filter(function(e){return !replaced.includes(e.title)});
    function add(event){if(!d.events.some(function(e){return e.title===event.title}))d.events.push(event)}
    var ticket=d.events.find(function(e){return e.title==="玉龙雪山门票与索道预约"});
    if(ticket){
      ticket.title="玉龙雪山门票与两段索道 · 已购";
      ticket.booking="已购：云杉坪小索道 08:00–08:30；冰川公园大索道 14:00–14:30";
      ticket.note="携带身份证，严格按票面检票地点与时段候乘；迟到可能被调整至16:30后集中候乘";
    }
    add({time:"05:00",end:"06:15",title:"丽江古城 → 甘海子瑞士风情园",kind:"交通",route:"提前约好能进入景区核心区域的正规包车，目的地直接写“甘海子瑞士风情园”",booking:"前一晚向司机确认早间通行、进山核验、停车和返程价格；如遇动态分流，以景区现场引导为准",note:"市区至甘海子高峰参考约80分钟，05:00出发为进山核验和早间车流留足缓冲",platform:"玉龙雪山景区公告",link:"https://www.lijiang.cn/news/travel/article/167852.html"});
    add({time:"06:15",end:"07:15",title:"瑞士风情园 · 等日照金山",kind:"景点",route:"选择面向玉龙十三峰、无遮挡且不影响通行的安全位置",booking:"日出模型参考06:58；若峰顶和东方天空同时出现晴窗，预计金色窗口约06:58–07:10",note:"8月26日多模型对06:00–08:00总云量预报接近99%–100%，当前成功率偏低；8月31日和9月1日晚在天气页再次刷新，现场以云层变化为准"});
    add({time:"07:15",end:"07:45",title:"步行至雪川游客港 · 游客中心早餐",kind:"美食",route:"瑞士风情园 → 甘海子游客中心/雪厨附近，按现场标识前往云杉坪C检票口",note:"只吃米线、包子、热饮等快餐；07:45前结束，不把早餐拖到检票时间"});
    add({time:"07:45",end:"08:00",title:"云杉坪小索道 · 提前候检",kind:"交通",route:"到票面指定检票口等候，身份证和票码提前准备好",booking:"票面时段 08:00–08:30；检票点和流线以“丽江旅游集团”小程序及现场标识为准"});
    add({time:"08:00",end:"10:20",title:"云杉坪小索道＋草甸慢游",kind:"景点",route:"观光车 → 云杉坪索道下站 → 索道上山 → 草甸精华段 → 原路下山",note:"10:20是硬截止；以拍雪山、草甸和森林为主，不走完整大环线，为蓝月谷与大索道保留体力"});
    add({time:"10:20",end:"10:50",title:"云杉坪 → 蓝月谷",kind:"交通",route:"按现场引导乘景区环保车前往蓝月谷；客流大时预留排队时间"});
    add({time:"10:50",end:"12:25",title:"蓝月谷 · 正午通透水色拍照",kind:"景点",route:"优先玉液湖 → 镜潭湖 → 蓝月湖，按返程上车点调整顺序",cost:"蓝月谷电瓶车当前参考：单段¥10/人、全段¥40/人",booking:"时间紧建议使用分段或全程电瓶车，12:25必须开始撤离",note:"11:30–12:20是主拍窗口；正午人物用侧身、背影或侧逆光，避免面向太阳产生硬阴影",platform:"2026年景区票务通告",link:"https://www.yn.xinhuanet.com/20260702/e8f8d1a27e2845b4bf54cfc5ef8f5d36/c.html"});
    add({time:"12:25",end:"12:50",title:"蓝月谷 → 雪川游客港",kind:"交通",route:"立即前往返程候车点，乘环保车返回雪川游客港",note:"12:00–15:00为蓝月谷方向客流集中时段，宁可提前撤离，不占用大索道缓冲"});
    add({time:"12:50",end:"13:20",title:"游客中心简餐",kind:"美食",route:"雪厨或游客中心选择出餐快的米线、面食、包子与热饮",note:"提前决定餐品，30分钟内结束；可随身带巧克力和能量食品在大索道后补充"});
    add({time:"13:20",end:"14:00",title:"冰川公园大索道 · 提前到检票区",kind:"交通",route:"按票面和当天公告前往冰川公园索道指定检票口",booking:"票面时段 14:00–14:30；13:20先到区域内等待，但不得早于官方允许时段强行检票",note:"下午天气和索道运行可能变化，持续关注景区短信、广播及官方动态"});
    add({time:"14:00",end:"16:30",title:"冰川公园大索道＋雪山栈道",kind:"景点",route:"环保车 → 大索道下站 → 索道至4506米 → 按身体状况决定是否继续步行",note:"上午已活动较多，下午慢走、不奔跑；出现持续头痛、胸闷、恶心或步态不稳立即停止上行并下撤"});
    add({time:"16:30",end:"17:05",title:"冰川公园 → 甘海子游客中心",kind:"交通",route:"索道下山后按现场标识乘环保车返回游客中心",note:"与早上包车司机提前约好会合位置，避免散场后临时找车"});
    add({time:"17:05",end:"18:25",title:"甘海子游客中心 → 丽江古城",kind:"交通",route:"使用早上约好的正规包车返回丽江古城南门或客栈附近",note:"按晚高峰预留约80分钟；若索道延误，直接顺延，不在山脚增加项目"});
    add({time:"18:30",end:"20:00",title:"丽江古城晚餐＋回客栈休息",kind:"美食",route:"古城南门或客栈附近吃热食，饭后不再安排远距离活动",note:"雪山日消耗较大，少酒、多补水、早点休息"});
    dayGuides["9/2"]={title:"瑞士风情园日出 → 两段索道 → 蓝月谷",tips:["日出模型为06:58，可见时金色窗口预估06:58–07:10；当前多模型云量极高，出发前两晚必须刷新","08:00–08:30云杉坪、14:00–14:30冰川公园均已购票，所有移动围绕票面时段倒推","蓝月谷安排10:50–12:25，正午水色是主角；12:25无论拍摄进度如何都要撤离"],source:"https://www.yn.xinhuanet.com/20260718/f2d1560d5043462c9c5967496da38808/c.html"};
    d.events.sort(function(a,b){return String(a.time).localeCompare(String(b.time))});
    localStorage.setItem(rev,"1");save();
  })();

  (function runDaliEastArrivalPlanUpgrade(){
    var rev=KEY+"-dali-qingshanjian-yunxiang-v1";
    if(localStorage.getItem(rev)==="1")return;
    var d=state.days.find(function(x){return x.date==="8/30"});
    if(!d)return;
    var replaced=[
      "挖色酒店 → 双廊古镇",
      "双廊古镇 · 玉几岛沿海慢拍",
      "双廊古镇 · 临水街巷慢拍",
      "WUJI CAFE · 270°洱海落日拍照",
      "双廊早晚餐＋洱海日落",
      "双廊晚餐 · 经济半小食",
      "双廊 → 挖色酒店"
    ];
    d.events=d.events.filter(function(e){return !replaced.includes(e.title)});
    function add(event){if(!d.events.some(function(e){return e.title===event.title}))d.events.push(event)}
    add({time:"14:00",end:"15:15",title:"挖色酒店 → 清山见",kind:"交通",route:"建议预约同一辆正规包车全程等候；导航务必使用高德搜索“清山见”，上车后让司机与店家再次确认落点",booking:"清山见公开信息较少，出发前在小红书原帖确认当天营业与高德定位；包车先确认8小时价格、等候费和晚间返程",note:"百度地图上的同名定位有用户反馈不准；东岸道路和雨天路况会影响车程，15:15前后到达即可，不为赶时间让司机超速",platform:"小红书",link:"https://xhslink.cn/o/5NWWc7fJaux"});
    add({time:"15:15",end:"16:50",title:"清山见 · 花园海景慢拍",kind:"咖啡",route:"先拍临海花园、花墙与露台，再坐下喝饮品休息",cost:"作者回复参考：约¥48/人起，一人一消",booking:"营业、低消、可否换装及准确入口以当天店家回复为准",note:"原帖作者说一小时内能拍完；给你留95分钟，浅色长裙或低饱和穿搭更衬花园和洱海。气泡水被作者评价一般，可现场换咖啡或其他饮品",platform:"小红书",link:"https://xhslink.cn/o/5NWWc7fJaux"});
    add({time:"16:50",end:"17:50",title:"清山见 → 云想山",kind:"交通",route:"继续使用原包车，导航“大理云想山风景区”；根据实时路况走海东—满江方向",note:"这一小时是估算缓冲；若17:50仍未到，直接缩短云想山免费区拍摄，不再增加文笔村咖啡"});
    add({time:"17:50",end:"19:40",title:"云想山 · 日落到蓝调",kind:"景点",route:"免费观景区以大草坪、S弯公路和俯瞰洱海机位为主；收费娱乐项目不设为必玩",booking:"景区公开信息显示全年全天开放，部分娱乐项目另有售票与停止入场时间；若想玩路极，出发前电话 19987227361 核对",note:"8月底建议把19:00前后的柔光、日落和随后蓝调作为主拍段；山顶风大，随身带薄外套。雨雾很重时不等夜景，提前下山吃饭",platform:"携程攻略",link:"https://you.ctrip.com/sight/dalicity1445616/145073729.html"});
    add({time:"19:40",end:"20:25",title:"云想山 → 文笔村晚餐",kind:"交通",route:"下山后沿返挖色方向去文笔村；上车即电话确认餐厅仍接单",note:"文笔村本次不再单独逛彩虹路和咖啡店，只作为返程晚餐落脚点；若山上延误或餐厅停止接单，改在海东/酒店附近吃，不硬赶"});
    add({time:"20:25",end:"21:20",title:"岛七土菜馆 · 白族晚餐",kind:"美食",route:"文笔村蜜悦海景酒店旁约200米",cost:"公开页面参考人均约¥82",booking:"公开营业时间参考10:00–21:30；务必提前电话确认最后点单时间并预留座位",note:"两人可点酸辣鱼或黄焖鸡二选一，再配水性杨花/包浆豆腐；野生菌必须由正规餐厅充分煮熟，不饮酒、不自行尝试不认识的菌子",platform:"携程美食",link:"https://gs.ctrip.com/html5/you/foods/fooddetail/1445616/78230688.html"});
    add({time:"21:20",end:"22:10",title:"文笔村 → 挖色酒店",kind:"交通",route:"继续使用已预约包车返回挖色酒店，实际上车点和时间以餐厅为准",note:"预计22点左右回房，已经是到达日的上限；如果两人明显疲惫，优先删掉云想山，清山见后直接吃饭回酒店"});
    dayGuides["8/30"]={title:"清山见 → 云想山 · 两个出片点就够了",tips:["清山见用高德导航，先确认准确入口；原帖参考一人一消约48元","文笔村值得看彩虹路与夕地咖啡，但和清山见同属海东海景拍照，本次不再重复占用下午","云想山拍日落和蓝调，返程在文笔村吃岛七；整段建议同一辆正规包车等候"],source:"https://xhslink.cn/o/5NWWc7fJaux"};
    [
      {id:"wish-xhs-qingshanjian",platform:"小红书",title:"清山见 · 海东花园海景拍照",link:"https://xhslink.cn/o/5NWWc7fJaux",note:"作者公开信息：高德定位更可靠，一人一消约48元；营业与入口出发前再确认。已安排8月30日15:15。"},
      {id:"wish-dali-yunxiang",platform:"攻略",title:"云想山 · 大草坪日落与蓝调",link:"https://you.ctrip.com/sight/dalicity1445616/145073729.html",note:"已安排8月30日17:50；免费观景为主，收费娱乐项目出发前核对。山顶风大带薄外套。"},
      {id:"wish-wenbi-xidi",platform:"攻略",title:"文笔村 · 夕地咖啡与彩虹路（备选）",link:"https://dali.yunnan.cn/system/2025/08/04/033571496.shtml",note:"文笔村本身值得，但与清山见同为海东海景出片体验。这次先不硬塞，若以后替换清山见，可选夕地咖啡＋彩虹路。"},
      {id:"wish-ctrip-daoqi",platform:"其他",title:"岛七土菜馆 · 文笔村白族晚餐",link:"https://gs.ctrip.com/html5/you/foods/fooddetail/1445616/78230688.html",note:"公开参考10:00–21:30、人均约82元；已安排云想山后顺路晚餐，必须提前确认最后点单时间。"}
    ].forEach(function(item){if(!savedItems.some(function(x){return x.id===item.id||x.link===item.link}))savedItems.push(item)});
    d.events.sort(function(a,b){return String(a.time).localeCompare(String(b.time))});
    localStorage.setItem(rev,"1");save();
  })();

  (function runWujiBeforeLijiangUpgrade(){
    var rev=KEY+"-wuji-before-lijiang-v1";
    if(localStorage.getItem(rev)==="1")return;
    var d=state.days.find(function(x){return x.date==="8/31"});
    if(!d)return;
    var replaced=[
      "挖色午餐",
      "挖色 → 丽江古城南门",
      "丽江古城第一夜 · 一路慢逛"
    ];
    d.events=d.events.filter(function(e){return !replaced.includes(e.title)});
    function add(event){if(!d.events.some(function(e){return e.title===event.title}))d.events.push(event)}
    add({time:"12:00",end:"12:45",title:"挖色酒店 → 双廊古镇",kind:"交通",route:"退房后用正规包车或平台跨城车先到双廊；大件行李留在车辆后备箱并由司机全程看管",booking:"建议直接预约“挖色—双廊等候—丽江”的一口价车辆，确认高速费、等候费、行李保管与夜间到达价格",note:"双廊位于挖色北侧，也是继续去丽江的方向；不用返回大理站或绕行海西"});
    add({time:"12:45",end:"13:50",title:"双廊午餐 · 先吃正餐",kind:"美食",route:"选择双廊南门或停车点附近、能快速出餐的白族菜馆",note:"下午主要在咖啡店拍照，先吃酸辣鱼、黄焖鸡或米线等正餐；七分饱，避免长时间只靠甜品和咖啡"});
    add({time:"14:00",end:"18:50",title:"WUJI CAFE · 从午后拍到金色柔光",kind:"咖啡",route:"午餐后由司机送到店家确认的停车/接驳点；重点拍油画框木窗、悬崖露台、草坪与苍山洱海全景",cost:"公开体验参考：普通咖啡约¥48起，实际低消和套餐以店内为准",booking:"出发前一天通过平台确认营业、预约、低消、行李和停车接驳；若排队较长，先坐下休息，17:30后再集中拍人像",note:"公开攻略推荐傍晚18:00–19:00拍摄；本段保留近5小时，不必一直排机位。18:20开始收尾，18:50准时下山上车，不把跨城夜车拖到太晚",platform:"抖音公开推荐",link:"https://jingxuan.douyin.com/m/video/7635313266427743497"});
    add({time:"18:50",end:"21:40",title:"双廊 WUJI → 丽江古城",kind:"交通",route:"使用中午已约好的正规跨城车，直接到丽江古城南门或客栈可停靠点",booking:"按约2.5–3小时预留；上车前确认司机状态、车牌、目的地和中途服务区，拒绝疲劳驾驶",note:"离店前买面包、水和水果作随车补给；途中不催司机，雨夜或拥堵时允许晚到，安全优先"});
    add({time:"22:10",end:"23:10",title:"丽江古城第一夜 · 热食＋短走",kind:"逛吃",route:"只在客栈附近吃米线、馄饨或腊排骨小锅，再走一小段灯景街巷",note:"不再从南门完整走到大水车；如果车程延误或疲惫，直接外卖/客栈附近吃饭后睡觉，完整古城留给9月3日上午"});
    var stay=d.events.find(function(e){return e.kind==="住宿"});
    if(stay){stay.time="21:40";if(String(stay.note||"").indexOf("晚到")<0)stay.note=(stay.note?stay.note+"；":"")+"预计21:40后晚到，提前联系客栈确认古城限行后的最近下车点和接行李方式"}
    dayGuides["8/31"]={title:"挖色退房 → 双廊 WUJI → 晚到丽江",tips:["双廊在挖色北侧，退房后先去WUJI再继续去丽江，比回大理站顺路","WUJI留14:00–18:50，重点拍18:00后的金色柔光；18:50必须开始跨城","预计21:40左右到丽江，第一晚只吃热食和短走，完整古城留到9月3日上午"],source:"https://jingxuan.douyin.com/m/video/7635313266427743497"};
    d.events.sort(function(a,b){return String(a.time).localeCompare(String(b.time))});
    localStorage.setItem(rev,"1");save();
  })();

  (function runEarlyLijiangCheckinUpgrade(){
    var rev=KEY+"-wuji-lijiang-1900-v1";
    if(localStorage.getItem(rev)==="1")return;
    var d=state.days.find(function(x){return x.date==="8/31"});
    if(!d)return;
    function find(title){return d.events.find(function(e){return e.title===title})}
    function set(title,time,end){var e=find(title);if(e){e.time=time;e.end=end}return e}
    set("挖色轻环线 · 鹿卧山安全观景位 → 挖色码头 → 小普陀","08:45","10:05");
    var packing=set("回酒店整理与退房","10:05","11:00");
    if(packing)packing.note="11:00前退房；提前约好11:00出发的正规跨城包车，大件行李全程留在车辆后备箱";
    set("挖色酒店 → 双廊古镇","11:00","11:45");
    set("双廊午餐 · 先吃正餐","11:45","12:35");
    var wuji=set("WUJI CAFE · 从午后拍到金色柔光","12:45","16:00");
    if(wuji){wuji.title="WUJI CAFE · 午后悬崖海景慢拍";wuji.note="19:00到丽江是硬目标，因此不等WUJI日落；12:45–16:00足够拍油画框木窗、悬崖露台、草坪和全景。15:40开始收尾，16:00准时上车"}
    var drive=set("双廊 WUJI → 丽江古城","16:00","19:00");
    if(drive){drive.booking="按约2.5–3小时预留，目标19:00到客栈；上车前确认司机状态、车牌、目的地与古城最近下车点";drive.note="16:00是硬出发时间。雨天或拥堵时不催司机，允许小幅晚到；安全优先"}
    var firstNight=set("丽江古城第一夜 · 热食＋短走","19:30","22:00");
    if(firstNight){firstNight.title="丽江古城第一夜 · 晚餐＋灯景慢逛";firstNight.route="客栈 → 古城南门 → 七一街 → 木府外街巷；是否继续去四方街按体力决定";firstNight.note="19:00左右先入住，19:30吃热食后再逛；累了随时回客栈，不追求第一晚走完整个古城"}
    var stay=d.events.find(function(e){return e.kind==="住宿"});
    if(stay){stay.time="19:00";stay.note=String(stay.note||"").replace(/预计21:40后晚到[^；]*；?/g,"");if(String(stay.note||"").indexOf("19:00")<0)stay.note=(stay.note?stay.note+"；":"")+"目标19:00左右办理入住，提前确认古城限行后的最近下车点和接行李方式"}
    dayGuides["8/31"]={title:"WUJI午后慢拍 → 19点到丽江",tips:["上午挖色轻环线缩短到10:05，11:00退房出发去双廊","WUJI安排12:45–16:00，保留3小时15分拍照，但不再等待落日","16:00准时跨城，目标19:00入住；19:30后正常吃晚饭和逛古城灯景"],source:"https://jingxuan.douyin.com/m/video/7635313266427743497"};
    d.events.sort(function(a,b){return String(a.time).localeCompare(String(b.time))});
    localStorage.setItem(rev,"1");save();
  })();

  function renderSavedItem(item){
    var p=item.platform||platformOf(item);
    var cl=p==="美团"?"mt":p==="小红书"?"xhs":p==="抖音"?"dy":"";
    return '<article class="saved-card"><div class="source"><span class="badge '+cl+'">'+esc(p||"链接")+'</span><p><b>'+esc(item.title)+'</b><small>单独收藏</small></p><a href="'+esc(item.link)+'" target="_blank" rel="noopener noreferrer">打开原页</a></div>'+(item.note?'<p class="saved-note">'+esc(item.note)+'</p>':"")+'<div class="saved-actions"><button class="soft" onclick="savedToDay(\''+esc(item.id)+'\')">加入今天</button><button class="remove" onclick="removeSaved(\''+esc(item.id)+'\')">删除</button></div></article>';
  }
  saved=function(){
    var all=state.days.flatMap(function(d,di){return d.events.map(function(e,ei){return Object.assign({},e,{di:di,ei:ei,date:d.date})}).filter(function(e){return e.link})});
    var form='<form class="saved-add" onsubmit="addSaved(event)"><b>＋ 新增收藏</b><p>可以直接粘贴分享文字，我会自动提取其中的链接。</p><div class="saved-grid"><select name="platform" aria-label="平台"><option>小红书</option><option>美团</option><option>抖音</option><option>其他</option></select><input name="title" required placeholder="推荐名称"><textarea class="wide share-input" name="link" required placeholder="粘贴链接或整段分享文字"></textarea><textarea class="wide" name="note" placeholder="推荐理由、必点菜或拍照提示"></textarea></div><button>保存收藏</button></form>';
    var eventCards=all.map(function(e){return '<div class="saved-card">'+source(e)+'<small>'+esc(e.date)+" · "+esc(state.days[e.di].city)+'</small><div class="saved-actions"><button class="soft" onclick="openSavedEvent('+e.di+','+e.ei+')">查看安排</button><button class="remove" onclick="removeEventSaved('+e.di+','+e.ei+')">移出收藏</button></div></div>'}).join("");
    var custom=savedItems.map(renderSavedItem).join("");
    var empty=!eventCards&&!custom?'<div class="empty">还没有收藏，粘贴小红书、美团或抖音链接试试。</div>':"";
    return '<section class="panel"><p class="eyebrow" style="color:#987757">INSPIRATION</p><div class="saved-head"><h2>收藏的推荐</h2><span class="free-tag">'+(savedItems.length+all.length)+" 条</span></div>"+form+custom+eventCards+empty+"</section>";
  };
  window.addSaved=function(ev){
    ev.preventDefault();
    var f=new FormData(ev.target);
    var raw=String(f.get("link")||"").trim(),match=raw.match(/https?:\/\/[^\s】]+/i),link=match?match[0]:raw;
    if(!/^https?:\/\//i.test(link)){toast("没有识别到有效链接");return}
    savedItems.unshift({id:"saved-"+Date.now(),platform:String(f.get("platform")||"其他"),title:String(f.get("title")||"").trim(),link:link,note:String(f.get("note")||"").trim()});
    ev.target.reset();save();render();toast("已加入收藏");
  };
  window.removeSaved=function(id){
    savedItems=savedItems.filter(function(x){return x.id!==id});
    save();render();toast("已删除收藏");
  };
  window.savedToDay=function(id){
    var item=savedItems.find(function(x){return x.id===id});if(!item)return;
    state.tab="trip";render();openModal();
    var f=document.getElementById("eventForm");
    f.elements.title.value=item.title;f.elements.link.value=item.link;f.elements.platform.value=item.platform;f.elements.note.value=item.note||"";
  };
  window.removeEventSaved=function(di,ei){
    var item=state.days[di]&&state.days[di].events[ei];if(!item)return;
    item.link="";item.platform="";save();render();toast("已移出收藏，原行程仍保留");
  };
  window.openSavedEvent=function(di,ei){
    state.active=di;state.tab="trip";render();openModal(ei);
  };

  function refreshSavedPicker(){
    var select=document.getElementById("savedPicker");if(!select)return;
    var custom=savedItems.map(function(item){return '<option value="'+esc(item.id)+'">'+esc((item.platform||"链接")+" · "+item.title)+'</option>'}).join("");
    var linked=state.days.flatMap(function(d,di){return d.events.map(function(e,ei){return{e:e,id:"event-"+di+"-"+ei}}).filter(function(x){return x.e.link})}).map(function(x){return '<option value="'+x.id+'">'+esc((x.e.platform||"行程收藏")+" · "+x.e.title)+'</option>'}).join("");
    select.innerHTML='<option value="">选择一条收藏（可选）</option>'+custom+linked;
  }
  function enhanceEventModal(){
    var form=document.getElementById("eventForm"),grid=form&&form.querySelector(".formgrid"),details=grid&&grid.querySelector(".details");
    if(!grid||!details||document.getElementById("savedPicker"))return;
    var field=document.createElement("div");field.className="field full saved-picker";
    field.innerHTML='<label>从收藏直接加入</label><select id="savedPicker" onchange="applySavedToForm(this.value)"></select><small>选择后会自动填入标题、平台、原链接和备注，你仍可继续修改时间。</small>';
    grid.insertBefore(field,details);refreshSavedPicker();
  }
  window.applySavedToForm=function(id){
    var item=savedItems.find(function(x){return x.id===id}),m=id.match(/^event-(\d+)-(\d+)$/),f=document.getElementById("eventForm");
    if(!item&&m&&state.days[Number(m[1])])item=state.days[Number(m[1])].events[Number(m[2])];if(!item||!f)return;
    f.elements.title.value=item.title||"";f.elements.kind.value="景点";f.elements.link.value=item.link||"";f.elements.platform.value=item.platform||"其他";f.elements.note.value=item.note||"";
    var details=f.querySelector("details");if(details)details.open=true;
  };
  enhanceEventModal();
  var baseOpenModal=openModal;
  openModal=function(i){baseOpenModal(i);refreshSavedPicker()};

  function parseDay(text){
    var m=text.match(/([89])\s*[月\/.]\s*(\d{1,2})/);
    if(!m)return state.active;
    var key=Number(m[1])+"/"+Number(m[2]);
    var idx=state.days.findIndex(function(d){return d.date===key});
    return idx<0?state.active:idx;
  }
  function parseClock(text){
    var stripped=text.replace(/[89]\s*[月\/.]\s*\d{1,2}\s*日?/,"");
    var m=stripped.match(/(早上|上午|中午|下午|傍晚|晚上)?\s*(\d{1,2})(?:\s*[点:：时]\s*(\d{1,2})?)?/);
    if(!m)return"待确认";
    var h=Number(m[2]),min=Number(m[3]||0),period=m[1]||"";
    if((period==="下午"||period==="傍晚"||period==="晚上")&&h<12)h+=12;
    if(period==="中午"&&h<11)h+=12;
    return String(h).padStart(2,"0")+":"+String(min).padStart(2,"0");
  }
  function guessKind(title){
    if(/吃|餐|咖啡|火锅|米线|小吃/.test(title))return"美食";
    if(/车|机场|高铁|公交|打车|前往|返回/.test(title))return"交通";
    if(/酒店|民宿|入住|退房/.test(title))return"住宿";
    return"景点";
  }
  function cleanTitle(text){
    return text.replace(/[89]\s*[月\/.]\s*\d{1,2}\s*日?/g,"").replace(/(早上|上午|中午|下午|傍晚|晚上)?\s*\d{1,2}\s*(点|时|[:：]\s*\d{1,2})?/g,"").replace(/^(请|帮我|我想|想要)?\s*(添加|安排|加入|加一个|去)/,"").replace(/到行程|到时间线|进日程/g,"").trim().replace(/[，。,.]$/,"");
  }
  function freeSlots(d){
    var times=d.events.filter(function(e){return /^\d{2}:\d{2}$/.test(e.time)}).map(function(e){return e.time+" "+e.title});
    return times.length?times.slice(0,6).join("、"):"当天还没有确定时间的安排";
  }
  function localReply(text){
    var idx=parseDay(text),d=state.days[idx];
    if(/添加|安排|加入|加一个/.test(text)){
      var title=cleanTitle(text);
      if(title.length<2)return"可以，请再告诉我具体安排，例如：“9月1日下午3点安排白沙古镇”。";
      var clock=parseClock(text);
      d.events.push({time:clock,end:"",title:title,kind:guessKind(title),note:"由本地行程助手添加"});
      d.events.sort(function(a,b){return a.time.localeCompare(b.time)});
      state.active=idx;save();
      return"已经把“"+title+"”加入 "+d.date+" 的 "+clock+"。你可以回到行程页继续补充路程和费用。";
    }
    if(/玉龙雪山|高反|氧气/.test(text))return"9月2日玉龙雪山建议：身份证、厚外套、防晒、巧克力和水；缓慢活动，不要奔跑。氧气瓶可到丽江正规门店购买，索道时段以预约票面为准。";
    if(/穿搭|穿什么|衣服/.test(text))return d.date+" "+d.city+"：建议分层穿搭。普通内搭＋便携外套；雪山和香格里拉加厚外套，雨天带防水层，全天注意防晒。";
    if(/交通|怎么去|打车|公交/.test(text)){
      var routes=d.events.filter(function(e){return e.kind==="交通"||e.kind==="航班"||e.kind==="铁路"}).map(function(e){return e.time+" "+e.title+(e.route?"："+e.route:"")});
      return routes.length?routes.join("\n"):"当天暂时没有交通安排，可以告诉我出发地、目的地和时间。";
    }
    if(/空档|空闲|冲突|时间/.test(text))return d.date+" 目前的时间点：\n"+freeSlots(d)+"。\n我会按开始时间排序，新增时尽量预留交通和用餐缓冲。";
    if(/今天|当天|行程|安排/.test(text))return d.date+" · "+d.city+"\n"+d.events.map(function(e){return e.time+" "+e.title}).join("\n");
    return"我可以免费帮你：\n1. 查看某天安排或交通\n2. 给出穿搭、雪山准备建议\n3. 用自然语言新增行程\n试试说：“9月4日上午10点安排松赞林寺”。";
  }
  assistant=function(){
    var bubbles=assistantMessages.map(function(m){return '<div class="bubble '+(m.role==="user"?"user":"assistant")+'">'+esc(m.text)+"</div>"}).join("");
    return '<section class="assistant-panel"><p class="eyebrow" style="color:#987757">TRIP ASSISTANT</p><div class="assistant-title"><h2>行程小助手</h2><span class="free-tag">免费本地版</span></div><div class="chatbox" id="chatbox">'+bubbles+'</div><div class="quick-prompts"><button onclick="askAssistant(\'9月2日玉龙雪山要准备什么？\')">雪山准备</button><button onclick="askAssistant(\'9月6日交通怎么安排？\')">查看交通</button><button onclick="askAssistant(\'9月1日有哪些时间安排？\')">查看时间</button><button onclick="askAssistant(\'9月4日穿什么？\')">穿搭建议</button></div><form class="chat-form" onsubmit="chatSubmit(event)"><input name="message" required autocomplete="off" placeholder="例如：9月1日下午3点安排白沙古镇"><button>发送</button></form><p class="assistant-help">当前版本不调用付费 AI：所有分析在你的浏览器完成，不会上传聊天内容。</p></section>';
  };
  window.askAssistant=function(text){
    assistantMessages.push({role:"user",text:text});
    assistantMessages.push({role:"assistant",text:localReply(text)});
    persistUpgrade();render();
    setTimeout(function(){var box=document.getElementById("chatbox");if(box)box.scrollTop=box.scrollHeight},0);
  };
  window.chatSubmit=function(ev){
    ev.preventDefault();var f=new FormData(ev.target),text=String(f.get("message")||"").trim();if(text)askAssistant(text);
  };

  function weatherPlacesForDay(d){
    var transitions={
      "8/30":[weatherPlaces.shenzhen,weatherPlaces.dali],
      "8/31":[weatherPlaces.dali,weatherPlaces.lijiang],
      "9/3":[weatherPlaces.lijiang,weatherPlaces.shangri],
      "9/5":[weatherPlaces.shangri],
      "9/6":[weatherPlaces.shangri,weatherPlaces.kunming],
      "9/7":[weatherPlaces.kunming,weatherPlaces.shenzhen]
    };
    if(transitions[d.date])return transitions[d.date];
    if(/玉龙雪山/.test(d.city))return[weatherPlaces.snow];
    if(/昆明/.test(d.city))return[weatherPlaces.kunming];
    if(/香格里拉/.test(d.city))return[weatherPlaces.shangri];
    if(/丽江/.test(d.city))return[weatherPlaces.lijiang];
    return[weatherPlaces.dali];
  }
  function isoDate(d){
    var p=d.date.split("/");return"2026-"+String(p[0]).padStart(2,"0")+"-"+String(p[1]).padStart(2,"0");
  }
  function weatherInfo(code){
    if(code===0)return["晴","☀"];
    if(code<=3)return["多云","⛅"];
    if(code===45||code===48)return["雾","🌫"];
    if(code>=51&&code<=67)return["雨","🌧"];
    if(code>=71&&code<=77)return["雪","🌨"];
    if(code>=80&&code<=82)return["阵雨","🌦"];
    if(code>=95)return["雷雨","⛈"];
    return["多云","☁"];
  }
  function fallbackHours(d){
    var base=Number((d.weather.match(/(-?\d+)°C/)||[])[1]||20);
    return[6,9,12,15,18,21].map(function(h){var temp=base+(h>=12&&h<=15?2:h<=6||h>=21?-3:0);return{time:String(h).padStart(2,"0")+":00",temp:temp,feel:temp-1,rain:/雨/.test(d.weather)?55:20,cloud:/雨/.test(d.weather)?85:40,code:/雨/.test(d.weather)?61:h===12?1:2,wind:8}});
  }
  function weatherHours(d,place){
    var entry=weatherCache[place.name],target=isoDate(d);
    if(!entry||!entry.hourly||!entry.hourly.length)return fallbackHours(d);
    var found=entry.hourly.filter(function(x){return x.date===target&&Number(x.time.slice(0,2))%2===0});
    return found.length?found:fallbackHours(d);
  }
  function weatherChart(hours){
    var values=hours.map(function(h){return Number(h.temp)}),min=Math.min.apply(null,values),max=Math.max.apply(null,values),span=Math.max(4,max-min),w=Math.max(760,hours.length*78),left=40,top=28,bottom=86;
    var points=hours.map(function(h,i){var x=left+i*((w-left*2)/Math.max(1,hours.length-1)),y=top+(max-Number(h.temp))/span*(bottom-top);return{x:x,y:y,h:h}});
    var line=points.map(function(p){return p.x.toFixed(1)+","+p.y.toFixed(1)}).join(" ");
    var marks=points.map(function(p){var wi=weatherInfo(p.h.code);return '<g><circle cx="'+p.x+'" cy="'+p.y+'" r="4"/><text class="chart-temp" x="'+p.x+'" y="'+(p.y-10)+'">'+esc(p.h.temp)+'°</text><text class="chart-icon" x="'+p.x+'" y="116">'+wi[1]+'</text><text class="chart-rain" x="'+p.x+'" y="141">☂ '+esc(p.h.rain)+'%</text><text class="chart-time" x="'+p.x+'" y="164">'+esc(p.h.time)+'</text></g>'}).join("");
    return '<div class="chart-scroll"><svg class="weather-chart" viewBox="0 0 '+w+' 178" style="width:'+w+'px" role="img" aria-label="逐小时温度和降水概率曲线"><defs><linearGradient id="weatherFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#74a8d9" stop-opacity=".28"/><stop offset="1" stop-color="#74a8d9" stop-opacity="0"/></linearGradient></defs><polygon points="'+left+','+bottom+' '+line+' '+(w-left)+','+bottom+'" fill="url(#weatherFill)"/><polyline points="'+line+'"/><g class="chart-marks">'+marks+'</g></svg></div>';
  }
  function weatherPanel(d,place){
    var hours=weatherHours(d,place),entry=weatherCache[place.name],live=!!(entry&&entry.hourly&&entry.hourly.length),temps=hours.map(function(h){return Number(h.temp)}),rain=Math.max.apply(null,hours.map(function(h){return Number(h.rain)})),dawn=hours.filter(function(h){var n=Number(h.time.slice(0,2));return n>=6&&n<=8}),dawnCloud=Math.round(dawn.reduce(function(s,h){return s+Number(h.cloud||0)},0)/Math.max(1,dawn.length)),stamp=live?"模型预报 · 更新于 "+new Date(entry.fetchedAt).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"}):"行前参考 · 正在连接天气服务";
    var meili=/梅里/.test(place.name)?'<div class="meili-signal '+(dawnCloud<=45&&rain<45?'go':'wait')+'"><b>'+(dawnCloud<=45&&rain<45?'有晴窗，可以继续观察':'云雨风险高，暂不建议冲')+'</b><span>日出时段模型云量约 '+dawnCloud+'% · 9月6日日出约 07:05</span></div>':"";
    return '<section class="weather24"><header><div><p>24 小时预报 · '+esc(d.date)+'</p><b>'+esc(place.name)+'</b><strong>'+Math.min.apply(null,temps)+'° / '+Math.max.apply(null,temps)+'°</strong></div><span>'+stamp+'</span></header>'+meili+weatherChart(hours)+'<div class="weather-facts"><span>最高降水概率 <b>'+rain+'%</b></span><span>每 2 小时一个节点，左右滑动</span></div><footer><span>温度、体感、降水和风速来自 Open‑Meteo；越临近出发越可靠</span><button onclick="refreshWeather()">刷新</button></footer></section>';
  }
  function weatherPage(d){
    var places=weatherPlacesForDay(d);
    return '<div class="weather-page"><div class="forecast-note"><b>'+esc(d.date)+' · '+esc(d.city)+'</b><span>'+((places.length>1)?"跨城日已同时显示出发地和目的地":"查看当天逐小时趋势")+'</span></div>'+places.map(function(p){return weatherPanel(d,p)}).join("")+'<p class="weather-disclaimer">天气为数值模型预报，不是实况保证；雪山、索道和航班请在当天再次查看官方通知。</p></div>';
  }
  function requestWeatherPlace(d,place,force){
    var cached=weatherCache[place.name];
    if(!force&&cached&&Date.now()-cached.fetchedAt<30*60*1000)return;
    if(weatherLoading[place.name])return;weatherLoading[place.name]=true;
    var url="https://api.open-meteo.com/v1/forecast?latitude="+place.lat+"&longitude="+place.lon+"&hourly=temperature_2m,apparent_temperature,precipitation_probability,cloud_cover,weather_code,wind_speed_10m&forecast_days=16&timezone=Asia%2FShanghai";
    fetch(url).then(function(r){if(!r.ok)throw new Error("weather");return r.json()}).then(function(x){
      var h=x.hourly||{},items=(h.time||[]).map(function(t,i){return{date:t.slice(0,10),time:t.slice(11,16),temp:Math.round(h.temperature_2m[i]),feel:Math.round(h.apparent_temperature[i]),rain:h.precipitation_probability[i]||0,cloud:h.cloud_cover[i]||0,code:h.weather_code[i]||0,wind:Math.round(h.wind_speed_10m[i]||0)}});
      weatherCache[place.name]={fetchedAt:Date.now(),hourly:items};localStorage.setItem(WEATHERKEY,JSON.stringify(weatherCache));
    }).catch(function(){weatherCache[place.name]={fetchedAt:Date.now(),hourly:[]};localStorage.setItem(WEATHERKEY,JSON.stringify(weatherCache));toast("天气暂时无法更新，已显示行前参考")}).finally(function(){weatherLoading[place.name]=false;if(state.tab==="trip"&&weatherPlacesForDay(state.days[state.active]).some(function(p){return p.name===place.name}))render()});
  }
  function requestWeather(d,force){weatherPlacesForDay(d).forEach(function(place){requestWeatherPlace(d,place,force)})}
  window.refreshWeather=function(){var d=state.days[state.active];weatherPlacesForDay(d).forEach(function(p){delete weatherCache[p.name]});requestWeather(d,true);toast("正在刷新逐小时天气")};

  function cleanStop(text){
    return String(text||"").replace(/^[^：]+：/,'').split("·")[0].split("｜")[0].replace(/约\d+[\.\d]*公里.*/,"").replace(/\s+/g," ").trim();
  }
  function routeStops(d){
    var stops=[];function push(x){x=cleanStop(x);if(x&&x.length>1&&stops[stops.length-1]!==x)stops.push(x)}
    d.events.forEach(function(e){
      if(e.kind==="航班"||e.kind==="铁路"){push(e.from);push(e.to);return}
      if(e.kind==="住宿"){push(e.hotel||e.title);return}
      if(e.kind==="交通"&&/→/.test(e.route||"")){(e.route||"").split("→").forEach(push);return}
      if(e.kind==="景点"||e.kind==="美食"||e.kind==="逛吃")push(e.title);
    });
    return stops.slice(0,7);
  }
  function directionUrl(a,b,mode,d){
    var region=/昆明/.test(d.city)?"昆明":/香格里拉/.test(d.city)?"香格里拉":/丽江/.test(d.city)?"丽江":"大理";
    return"https://api.map.baidu.com/direction?origin="+encodeURIComponent(a)+"&destination="+encodeURIComponent(b)+"&mode="+mode+"&region="+encodeURIComponent(region)+"&output=html&src=webapp.mindy.yunnantrip";
  }
  function routePanel(d){
    var stops=routeStops(d),legs=[];for(var i=0;i<stops.length-1;i++)legs.push([stops[i],stops[i+1]]);
    if(!legs.length)return'<div class="empty">今天还没有足够的地点生成路线。</div>';
    return '<section class="route-panel"><header><p>今日路线</p><b>'+esc(stops.join(" → "))+'</b><span>每一段都可以直接用百度地图计算实时路线</span></header><div class="route-legs">'+legs.map(function(x,i){return '<article><i>'+(i+1)+'</i><div><b>'+esc(x[0])+'</b><span>到</span><b>'+esc(x[1])+'</b><nav><a href="'+directionUrl(x[0],x[1],"driving",d)+'" target="_blank" rel="noopener">打车/驾车</a><a href="'+directionUrl(x[0],x[1],"transit",d)+'" target="_blank" rel="noopener">公交</a><a href="'+directionUrl(x[0],x[1],"walking",d)+'" target="_blank" rel="noopener">步行</a></nav></div></article>'}).join("")+'</div><div class="map-upgrade"><b>百度地图内嵌版已预留</b><span>创建浏览器端 AK 后即可在这里显示地图、路线和实时耗时；当前按钮已经可直接使用。</span></div></section>';
  }
  function guidePanel(d){
    var g=dayGuides[d.date];if(!g)return"";
    return '<details class="guide" open><summary><span>当天攻略</span><b>'+esc(g.title)+'</b></summary><ul>'+g.tips.map(function(x){return"<li>"+esc(x)+"</li>"}).join("")+'</ul><a href="'+esc(g.source)+'" target="_blank" rel="noopener noreferrer">查看官方信息 / 地图</a></details>';
  }

  trip=function(){
    var d=state.days[state.active];
    var dayButtons=state.days.map(function(x,i){return '<button class="day '+(i===state.active?"active":"")+'" onclick="state.active='+i+';render()"><small>'+x.week+"</small><b>"+x.date+"</b></button>"}).join("");
    var controls='<div class="dayactions"><button class="ghost" onclick="importTransport()">粘贴交通</button><button class="ghost" onclick="openModal()">＋ 添加</button></div>';
    var views=[["timeline","☷ 时间线"],["map","⌖ 地图"],["cards","▦ 卡片"],["weather","☔ 天气"]].map(function(v){return '<button class="'+(state.view===v[0]?"active":"")+'" onclick="state.view=\''+v[0]+'\';render()">'+v[1]+"</button>"}).join("");
    var events=d.events.length?d.events.map(function(e,i){return eventCard(e,i,i===d.events.length-1)}).join(""):'<div class="empty">今天还没有安排，留一点空间给偶遇。</div>';
    var body=state.view==="map"?routePanel(d):state.view==="weather"?weatherPage(d):'<div class="'+(state.view==="cards"?"cardsview":"")+'">'+events+'</div>';
    var add='<button class="add" onclick="openModal()">＋ 添加安排</button><button class="importbtn" onclick="importTransport()">粘贴航班或铁路分享文字</button>';
    return hero()+'<section class="local-notice"><span>✓</span><p><b>本机编辑模式</b><small>修改自动保存在当前浏览器</small></p></section><nav class="days">'+dayButtons+'</nav><section class="content"><header class="dayhead"><div><p>DAY '+(state.active+1)+" · "+esc(d.date)+" "+esc(d.week)+"</p><h2>"+esc(d.city)+"</h2></div>"+controls+'</header><div class="views">'+views+"</div>"+body+guidePanel(d)+add+"</section>";
  };
  settings=function(){
    return '<section class="panel"><p class="eyebrow" style="color:#987757">LOCAL DATA</p><h2>本机数据与备份</h2><div class="setting"><div class="statusline"><span class="syncdot live"></span><b>本机编辑模式</b></div><p>所有修改只保存在当前浏览器，不会上传到 Supabase 或其他云端。换手机前请先导出备份。</p></div><div class="setting"><b>百度地图</b><p>当前“地图”页已能逐段调起百度地图计算打车、公交和步行路线，不需要 AK。浏览器端 AK 创建完成后，可继续升级为页面内嵌地图与实时耗时。</p><button onclick="state.tab=\'trip\';state.view=\'map\';render()">打开地图页</button></div><div class="setting"><b>24 小时天气</b><p>使用免密钥逐小时模型预报，包含温度曲线、体感温度和降水概率；跨城日同时显示两地，网络不可用时自动显示行前参考。</p><button onclick="state.tab=\'trip\';state.view=\'weather\';render();refreshWeather()">打开并刷新天气</button></div><div class="setting"><b>备份</b><p>建议在大幅调整前导出一份 JSON 备份。</p><button onclick="exportData()">导出备份</button><label class="filelabel">导入备份<input type="file" accept="application/json" onchange="importData(this)"></label></div><div class="setting"><b>免费行程助手</b><p>当前使用本地规则帮助查看时间、交通、穿搭和添加行程，不产生 API 费用。</p><button onclick="state.tab=\'assistant\';render()">打开助手</button></div><div class="setting"><b>恢复示例行程</b><p>会覆盖当前编辑的九日行程，请先导出备份。</p><button class="danger" onclick="resetData()">恢复初始数据</button></div></section>';
  };
  nav=function(){
    var items=[["trip","⌂","行程"],["saved","♡","收藏"],["assistant","✦","助手"],["list","◫","清单"],["settings","⚙","设置"]];
    return '<nav class="bottom">'+items.map(function(x){return '<button class="'+(state.tab===x[0]?"active":"")+'" onclick="state.tab=\''+x[0]+'\';render()"><b>'+x[1]+"</b>"+x[2]+"</button>"}).join("")+"</nav>";
  };
  render=function(){
    var content=state.tab==="trip"?trip():state.tab==="saved"?saved():state.tab==="assistant"?assistant():state.tab==="list"?checklist():settings();
    document.getElementById("app").innerHTML=content+nav();
    if(state.tab==="trip")setTimeout(function(){requestWeather(state.days[state.active],false)},0);
  };

  var legacyExportData=exportData;
  exportData=function(){
    var blob=new Blob([JSON.stringify({version:3,days:state.days,packingItems:packingItems,checked:checked,savedItems:savedItems},null,2)],{type:"application/json"});
    var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="云南旅行工作台-2026备份.json";a.click();URL.revokeObjectURL(a.href);toast("备份已导出");
  };

  render();
})();
