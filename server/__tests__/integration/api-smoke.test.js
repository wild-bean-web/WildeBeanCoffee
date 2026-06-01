/**
 * Integration smoke tests for API endpoints
 * Tests critical user flows that span multiple endpoints
 */
import request from 'supertest'
import { createTestApp } from '../app.js'
import { setupTestDB, teardownTestDB, clearDatabase } from '../setup.js'
import { createTestProduct, createTestMenuItem, createTestLocation } from '../helpers.js'

const app = createTestApp()

describe('API Integration Smoke Tests', () => {
  beforeAll(async () => {
    await setupTestDB()
  })

  afterAll(async () => {
    await teardownTestDB()
  })

  beforeEach(async () => {
    await clearDatabase()
  })

  describe('Product Browsing Flow', () => {
    it('should allow user to browse products, filter, and view details', async () => {
      // Create test products
      const product1 = await createTestProduct({
        name: 'Ethiopian Yirgacheffe',
        categories: ['single-origin', 'medium-roast'],
        inStock: true,
        active: true,
      })
      const product2 = await createTestProduct({
        name: 'Colombian Supremo',
        categories: ['single-origin', 'medium-roast'],
        inStock: true,
        active: true,
      })
      const product3 = await createTestProduct({
        name: 'Decaf Blend',
        categories: ['decaf'],
        inStock: false,
        active: true,
      })

      // 1. Browse all products
      const allProductsRes = await request(app).get('/api/products')
      expect(allProductsRes.status).toBe(200)
      expect(allProductsRes.body.data.length).toBeGreaterThanOrEqual(2)

      // 2. Filter by category
      const filteredRes = await request(app).get('/api/products?category=single-origin')
      expect(filteredRes.status).toBe(200)
      expect(filteredRes.body.data.length).toBe(2)
      expect(filteredRes.body.data.every(p => p.categories.includes('single-origin'))).toBe(true)

      // 3. Filter by inStock
      const inStockRes = await request(app).get('/api/products?inStock=true')
      expect(inStockRes.status).toBe(200)
      expect(inStockRes.body.data.length).toBe(2)
      expect(inStockRes.body.data.every(p => p.inStock === true)).toBe(true)

      // 4. Search products
      const searchRes = await request(app).get('/api/products?search=Ethiopia')
      expect(searchRes.status).toBe(200)
      expect(searchRes.body.data.length).toBe(1)
      expect(searchRes.body.data[0].name).toContain('Ethiopian')

      // 5. View product details
      const detailRes = await request(app).get(`/api/products/${product1._id}`)
      expect(detailRes.status).toBe(200)
      expect(detailRes.body.data._id).toBe(product1._id.toString())
      expect(detailRes.body.data.name).toBe('Ethiopian Yirgacheffe')
    })
  })

  describe('Menu Browsing Flow', () => {
    it('should allow user to browse menu items, filter by section, and view details', async () => {
      // Create test menu items
      const latte = await createTestMenuItem({
        name: 'Latte',
        section: 'Coffee & Espresso',
        available: true,
        active: true,
      })
      const croissant = await createTestMenuItem({
        name: 'Croissant',
        section: 'Bakery & Pastries',
        available: true,
        active: true,
      })
      const unavailable = await createTestMenuItem({
        name: 'Unavailable Item',
        section: 'Coffee & Espresso',
        available: false,
        active: true,
      })

      // 1. Browse all menu items
      const allMenuRes = await request(app).get('/api/menu')
      expect(allMenuRes.status).toBe(200)
      expect(allMenuRes.body.data.length).toBeGreaterThanOrEqual(2)

      // 2. Filter by section
      // Use query() method which handles URL encoding automatically
      const coffeeRes = await request(app)
        .get('/api/menu')
        .query({ section: 'Coffee & Espresso' })
      expect(coffeeRes.status).toBe(200)
      // Should find 2 items (latte and unavailable) - both have section 'Coffee & Espresso' and active=true
      expect(coffeeRes.body.data.length).toBe(2)
      expect(coffeeRes.body.data.every(item => item.section === 'Coffee & Espresso')).toBe(true)
      
      // Filter by section AND available to get only available items
      const availableCoffeeRes = await request(app)
        .get('/api/menu')
        .query({ section: 'Coffee & Espresso', available: true })
      expect(availableCoffeeRes.status).toBe(200)
      expect(availableCoffeeRes.body.data.length).toBe(1)
      expect(availableCoffeeRes.body.data[0].name).toBe('Latte')
      expect(availableCoffeeRes.body.data[0].available).toBe(true)

      // 3. Filter by available
      const availableRes = await request(app).get('/api/menu?available=true')
      expect(availableRes.status).toBe(200)
      expect(availableRes.body.data.length).toBe(2)
      expect(availableRes.body.data.every(item => item.available === true)).toBe(true)

      // 4. Search menu items
      const searchRes = await request(app).get('/api/menu?search=Latte')
      expect(searchRes.status).toBe(200)
      expect(searchRes.body.data.length).toBeGreaterThanOrEqual(1)
      // Search matches both name and description, so verify Latte is in results
      const latteResult = searchRes.body.data.find(item => item.name === 'Latte')
      expect(latteResult).toBeDefined()
      expect(latteResult.name).toBe('Latte')

      // 5. View menu item details
      const detailRes = await request(app).get(`/api/menu/${latte._id}`)
      expect(detailRes.status).toBe(200)
      expect(detailRes.body.data._id).toBe(latte._id.toString())
      expect(detailRes.body.data.name).toBe('Latte')
    })
  })

  describe('Order Creation Flow', () => {
    it('should allow user to create an order with products and menu items', async () => {
      // Create test data
      const product = await createTestProduct({
        name: 'Test Coffee',
        price: 15.99,
        active: true,
      })
      const menuItem = await createTestMenuItem({
        name: 'Test Latte',
        price: 4.89,
        active: true,
      })

      // Create order with both product and menu item
      const orderData = {
        customer: {
          name: 'John Doe',
          phone: '555-123-4567',
          email: 'john@example.com',
        },
        items: [
          {
            itemType: 'product',
            itemId: product._id.toString(),
            name: product.name,
            price: product.price,
            quantity: 2,
          },
          {
            itemType: 'menu',
            itemId: menuItem._id.toString(),
            name: menuItem.name,
            price: menuItem.price,
            quantity: 1,
          },
        ],
        taxRate: 0.0875,
        pickupTime: new Date(Date.now() + 3600000).toISOString(),
        notes: 'Extra hot latte',
      }

      // 1. Create order
      const createRes = await request(app)
        .post('/api/orders')
        .send(orderData)

      expect(createRes.status).toBe(201)
      expect(createRes.body.data).toHaveProperty('_id')
      expect(createRes.body.data.items).toHaveLength(2)
      expect(createRes.body.data.customer.name).toBe('John Doe')
      expect(createRes.body.data.status).toBe('placed')
      expect(createRes.body.data.paymentStatus).toBe('pending')

      // Verify totals are calculated correctly
      const expectedSubtotal = product.price * 2 + menuItem.price * 1
      const expectedTax = (expectedSubtotal * 0.0875).toFixed(2)
      const expectedTotal = (expectedSubtotal * 1.0875).toFixed(2)

      expect(parseFloat(createRes.body.data.totals.subtotal)).toBeCloseTo(expectedSubtotal)
      expect(parseFloat(createRes.body.data.totals.tax)).toBeCloseTo(parseFloat(expectedTax))
      expect(parseFloat(createRes.body.data.totals.total)).toBeCloseTo(parseFloat(expectedTotal))

      // 2. Retrieve order
      const orderId = createRes.body.data._id
      const getRes = await request(app).get(`/api/orders/${orderId}`)

      expect(getRes.status).toBe(200)
      expect(getRes.body.data._id).toBe(orderId)
      expect(getRes.body.data.items).toHaveLength(2)

      // 3. Update order status
      const updateRes = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .send({ status: 'preparing' })

      expect(updateRes.status).toBe(200)
      expect(updateRes.body.data.status).toBe('preparing')
    })

    it('should handle order creation with validation errors', async () => {
      // Try to create order with missing required fields
      const invalidOrder = {
        customer: {
          name: 'John Doe',
          // Missing phone
        },
        items: [],
      }

      const res = await request(app)
        .post('/api/orders')
        .send(invalidOrder)

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Validation failed')
      expect(res.body.details).toContain('customer.phone is required')
      expect(res.body.details).toContain('items must be a non-empty array')
    })
  })

  describe('Location and Distance Flow', () => {
    it('should allow user to get location and calculate distance', async () => {
      // Create test location
      await createTestLocation({
        name: 'Wild Bean Coffee',
        coordinates: {
          lat: 39.0834,
          lng: -77.1533,
        },
        active: true,
      })

      // 1. Get location
      const locationRes = await request(app).get('/api/location')
      expect(locationRes.status).toBe(200)
      expect(locationRes.body.data).toHaveProperty('name')
      expect(locationRes.body.data).toHaveProperty('coordinates')
      expect(locationRes.body.data.active).toBe(true)

      // 2. Calculate distance
      const userCoords = {
        lat: 39.0850,
        lng: -77.1500,
      }

      const distanceRes = await request(app)
        .post('/api/location/distance')
        .send(userCoords)

      expect(distanceRes.status).toBe(200)
      expect(distanceRes.body.data).toHaveProperty('distance')
      expect(distanceRes.body.data.distance).toHaveProperty('km')
      expect(distanceRes.body.data.distance).toHaveProperty('miles')
      expect(typeof distanceRes.body.data.distance.km).toBe('number')
      expect(typeof distanceRes.body.data.distance.miles).toBe('number')
      expect(distanceRes.body.data.distance.km).toBeGreaterThan(0)
    })
  })

  describe('End-to-End Order Flow', () => {
    it('should complete full order flow: browse -> select -> order -> track', async () => {
      // Setup: Create products and menu items
      const product = await createTestProduct({
        name: 'Ethiopian Yirgacheffe',
        price: 16.50,
        inStock: true,
        active: true,
      })
      const menuItem = await createTestMenuItem({
        name: 'Latte',
        price: 4.89,
        available: true,
        active: true,
      })
      await createTestLocation({
        active: true,
        coordinates: { lat: 39.0834, lng: -77.1533 },
      })

      // Step 1: Browse products
      const productsRes = await request(app).get('/api/products')
      expect(productsRes.status).toBe(200)
      const foundProduct = productsRes.body.data.find(p => p._id === product._id.toString())
      expect(foundProduct).toBeDefined()

      // Step 2: Browse menu
      const menuRes = await request(app).get('/api/menu')
      expect(menuRes.status).toBe(200)
      const foundMenuItem = menuRes.body.data.find(m => m._id === menuItem._id.toString())
      expect(foundMenuItem).toBeDefined()

      // Step 3: Get location for pickup
      const locationRes = await request(app).get('/api/location')
      expect(locationRes.status).toBe(200)
      expect(locationRes.body.data).toHaveProperty('hours')

      // Step 4: Create order
      const orderData = {
        customer: {
          name: 'Jane Smith',
          phone: '555-987-6543',
          email: 'jane@example.com',
        },
        items: [
          {
            itemType: 'product',
            itemId: product._id.toString(),
            name: product.name,
            price: product.price,
            quantity: 1,
          },
          {
            itemType: 'menu',
            itemId: menuItem._id.toString(),
            name: menuItem.name,
            price: menuItem.price,
            quantity: 2,
          },
        ],
        taxRate: 0.0875,
      }

      const createRes = await request(app)
        .post('/api/orders')
        .send(orderData)

      expect(createRes.status).toBe(201)
      const orderId = createRes.body.data._id

      // Step 5: Track order status
      const getOrderRes = await request(app).get(`/api/orders/${orderId}`)
      expect(getOrderRes.status).toBe(200)
      expect(getOrderRes.body.data.status).toBe('placed')

      // Step 6: Update order status (simulating kitchen workflow)
      const updateRes = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .send({ status: 'preparing' })

      expect(updateRes.status).toBe(200)
      expect(updateRes.body.data.status).toBe('preparing')

      // Step 7: Complete order
      const completeRes = await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .send({ status: 'completed', paymentStatus: 'paid' })

      expect(completeRes.status).toBe(200)
      expect(completeRes.body.data.status).toBe('completed')
      expect(completeRes.body.data.paymentStatus).toBe('paid')
    })
  })
})

