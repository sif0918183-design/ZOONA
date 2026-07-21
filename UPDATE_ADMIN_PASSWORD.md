# تحديث كلمة مرور المدير في قاعدة البيانات Supabase

لتحديث كلمة مرور المدير إلى كلمة المرور الجديدة: **`SAmy55@#`**، يرجى تشغيل أحد الاستعلامات التالية في **Supabase SQL Editor**:

## 1. استعلام التحديث المباشر:

```sql
UPDATE admin_settings
SET value = '723b2cb10f2197274835b66b5c7d2b8f95c22faf0f7ed1395e77ee276a947de7'
WHERE key = 'admin_password';
```

---

## 2. استعلام الإدراج أو التحديث (في حال عدم وجود الصف سابقاً):

```sql
INSERT INTO admin_settings (key, value)
VALUES ('admin_password', '723b2cb10f2197274835b66b5c7d2b8f95c22faf0f7ed1395e77ee276a947de7')
ON CONFLICT (key)
DO UPDATE SET value = EXCLUDED.value;
```

---

*ملاحظة: يتم تخزين كلمة المرور مشفرة بخوارزمية SHA-256 لضمان الحماية الفائقة ومنع قراءتها حتى لو تم الحصول على مفاتيح الاتصال بقاعدة البيانات.*
