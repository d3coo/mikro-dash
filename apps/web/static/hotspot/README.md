# MikroTik Captive Portal - Neon Oasis Theme

بوابة تسجيل دخول حديثة لـ MikroTik Hotspot بتصميم Neon Oasis.

## الملفات

| الملف | الوصف |
|-------|-------|
| `login.html` | صفحة تسجيل الدخول الرئيسية |
| `status.html` | صفحة حالة الاتصال (بعد تسجيل الدخول) |
| `logout.html` | صفحة تسجيل الخروج |
| `redirect.html` | صفحة التحويل بعد النجاح |
| `error.html` | صفحة الخطأ |

## التثبيت على MikroTik

### 1. رفع الملفات عبر WinBox

1. افتح WinBox واتصل بالراوتر
2. اذهب إلى **Files**
3. أنشئ مجلد `hotspot` إذا لم يكن موجوداً
4. ارفع جميع ملفات HTML إلى المجلد

### 2. رفع الملفات عبر FTP

```bash
ftp 192.168.1.109
# أدخل اسم المستخدم وكلمة المرور
cd hotspot
put login.html
put status.html
put logout.html
put redirect.html
put error.html
```

### 3. رفع الملفات عبر SCP

```bash
scp *.html admin@192.168.1.109:/hotspot/
```

## تكوين Hotspot

### عبر Terminal

```routeros
/ip hotspot profile
set default html-directory=hotspot login-by=http-chap,http-pap
```

### عبر WinBox

1. اذهب إلى **IP > Hotspot > Server Profiles**
2. افتح البروفايل المستخدم
3. في تبويب **Login**:
   - HTML Directory: `hotspot`
   - Login By: `HTTP CHAP` و `HTTP PAP`

## المتغيرات المستخدمة

هذه المتغيرات يتم استبدالها تلقائياً بواسطة MikroTik:

| المتغير | الوصف |
|---------|-------|
| `$(hostname)` | اسم الهوتسبوت |
| `$(username)` | اسم المستخدم |
| `$(password)` | كلمة المرور |
| `$(link-login)` | رابط صفحة تسجيل الدخول |
| `$(link-login-only)` | رابط تسجيل الدخول (للنموذج) |
| `$(link-logout)` | رابط تسجيل الخروج |
| `$(link-orig)` | الصفحة الأصلية المطلوبة |
| `$(link-redirect)` | رابط التحويل بعد النجاح |
| `$(error)` | رسالة الخطأ |
| `$(ip)` | عنوان IP للمستخدم |
| `$(mac)` | عنوان MAC للمستخدم |
| `$(uptime)` | مدة الجلسة |
| `$(bytes-in-nice)` | البيانات المستلمة |
| `$(bytes-out-nice)` | البيانات المرسلة |

## اختبار البوابة

1. اتصل بشبكة الـ WiFi
2. افتح أي موقع HTTP (مثل: http://neverssl.com)
3. يجب أن تظهر صفحة تسجيل الدخول

## ملاحظات

- الخطوط تُحمّل من Google Fonts، تأكد من السماح بالوصول إليها
- الصفحات تعمل بشكل كامل بدون JavaScript (للتوافق الأفضل)
- التصميم متجاوب ويعمل على جميع الأجهزة
- يدعم RTL للغة العربية

## تخصيص

### تغيير الألوان

عدّل متغيرات CSS في بداية كل ملف:

```css
:root {
  --primary: #0891b2;        /* اللون الرئيسي */
  --primary-light: #22d3ee;  /* اللون الفاتح */
  --success: #10b981;        /* لون النجاح */
  --danger: #ef4444;         /* لون الخطأ */
  /* ... */
}
```

### تغيير الشعار

استبدل الـ SVG في `login.html` بشعارك الخاص أو صورة.
