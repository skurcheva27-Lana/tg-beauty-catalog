require('dotenv').config()
const { supabase } = require('./src/db')

async function seed() {
  // Находим тестового мастера
  const { data: master, error } = await supabase
    .from('masters')
    .select('id, name, slug')
    .eq('slug', 'anna-test')
    .single()

  if (error || !master) {
    console.error('Мастер anna-test не найден:', error?.message)
    process.exit(1)
  }

  console.log(`Добавляю услуги для мастера: ${master.name} (${master.id})`)

  const services = [
    {
      master_id:    master.id,
      category:     'nails',
      name:         'Маникюр + гель-лак',
      short_desc:   'Покрытие гелем на 3–4 недели',
      description:  'Классический маникюр с покрытием гель-лаком. Включает обработку кутикулы, придание формы, базовое покрытие, цвет и топ. Держится 3–4 недели без сколов.',
      duration_min: 75,
      price:        2500,
      emoji:        '💅',
      gradient:     'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      photos:       ['💅', '✨', '🌸'],
      is_active:    true,
      sort_order:   1,
    },
    {
      master_id:    master.id,
      category:     'nails',
      name:         'Маникюр классический',
      short_desc:   'Ухоженные ногти без покрытия',
      description:  'Маникюр без покрытия — для тех, кто любит натуральный вид. Обработка кутикулы, придание формы, шлифовка.',
      duration_min: 45,
      price:        1500,
      emoji:        '✨',
      gradient:     'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
      photos:       ['✨', '🌸', '💎'],
      is_active:    true,
      sort_order:   2,
    },
    {
      master_id:    master.id,
      category:     'nails',
      name:         'Педикюр + гель-лак',
      short_desc:   'Идеальные ножки с покрытием',
      description:  'Полный педикюр с гель-лаком. Расслабляющая ванночка, обработка кожи, уход за кутикулой, покрытие. Держится 3–5 недель.',
      duration_min: 90,
      price:        2800,
      emoji:        '🦶',
      gradient:     'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      photos:       ['🦶', '✨', '🌺'],
      is_active:    true,
      sort_order:   3,
    },
    {
      master_id:    master.id,
      category:     'brows',
      name:         'Коррекция + окрашивание бровей',
      short_desc:   'Форма + насыщенный цвет хной',
      description:  'Коррекция формы бровей (воск + пинцет) и стойкое окрашивание хной. Результат держится 2–3 недели.',
      duration_min: 45,
      price:        1200,
      emoji:        '👁',
      gradient:     'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      photos:       ['👁', '✨', '🌿'],
      is_active:    true,
      sort_order:   4,
    },
    {
      master_id:    master.id,
      category:     'brows',
      name:         'Наращивание ресниц (классика)',
      short_desc:   '1 к 1, натуральный эффект',
      description:  'Классическое наращивание. Натуральное удлинение, держатся 3–4 недели при правильном уходе.',
      duration_min: 120,
      price:        3000,
      emoji:        '👀',
      gradient:     'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      photos:       ['👀', '✨', '🌟'],
      is_active:    true,
      sort_order:   5,
    },
  ]

  // Удаляем старые услуги мастера (если есть)
  await supabase.from('services').delete().eq('master_id', master.id)

  // Вставляем новые
  const { data, error: insertError } = await supabase
    .from('services')
    .insert(services)
    .select('id, name')

  if (insertError) {
    console.error('Ошибка добавления услуг:', insertError.message)
    process.exit(1)
  }

  console.log('Услуги добавлены:')
  data.forEach(s => console.log(` - ${s.name}`))
  process.exit(0)
}

seed()
