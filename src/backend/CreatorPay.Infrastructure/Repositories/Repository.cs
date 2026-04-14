using System.Linq.Expressions;
using CreatorPay.Domain.Common;
using CreatorPay.Domain.Interfaces;
using CreatorPay.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Infrastructure.Repositories;

public class Repository<T> : IRepository<T> where T : BaseEntity
{
    private readonly AppDbContext _db;
    private readonly DbSet<T> _set;

    public Repository(AppDbContext db)
    {
        _db = db;
        _set = db.Set<T>();
    }

    public async Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _set.FindAsync(new object[] { id }, ct);

    public async Task<List<T>> GetAllAsync(CancellationToken ct = default)
        => await _set.ToListAsync(ct);

    public async Task<IReadOnlyList<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
        => await _set.Where(predicate).ToListAsync(ct);

    public IQueryable<T> Query() => _set.AsQueryable();

    public void Add(T entity) => _set.Add(entity);

    public void Update(T entity) => _set.Update(entity);

    public void Remove(T entity) => _set.Remove(entity);
}

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _db;

    public UnitOfWork(AppDbContext db)
    {
        _db = db;
    }

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
        => await _db.SaveChangesAsync(ct);

    public async Task BeginTransactionAsync(CancellationToken ct = default)
        => await _db.Database.BeginTransactionAsync(ct);

    public async Task BeginTransactionAsync(System.Data.IsolationLevel isolationLevel, CancellationToken ct = default)
        => await _db.Database.BeginTransactionAsync(isolationLevel, ct);

    public async Task CommitTransactionAsync(CancellationToken ct = default)
    {
        if (_db.Database.CurrentTransaction != null)
            await _db.Database.CommitTransactionAsync(ct);
    }

    public async Task RollbackTransactionAsync(CancellationToken ct = default)
    {
        if (_db.Database.CurrentTransaction != null)
            await _db.Database.RollbackTransactionAsync(ct);
    }

    public void Dispose() => _db.Dispose();
}
