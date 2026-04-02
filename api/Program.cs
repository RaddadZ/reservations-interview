using System.Data;
using Db;
using Microsoft.Data.Sqlite;
using Repositories;

var builder = WebApplication.CreateBuilder(args);


{
    var Services = builder.Services;
    var connectionString =
        builder.Configuration.GetConnectionString("ReservationsDb")
        ?? "Data Source=reservations.db;Cache=Shared";

    Services.AddScoped(_ => new SqliteConnection(connectionString));
    Services.AddScoped<IDbConnection>(sp => sp.GetRequiredService<SqliteConnection>());
    Services.AddScoped<GuestRepository>();
    Services.AddScoped<RoomRepository>();
    Services.AddScoped<ReservationRepository>();
    Services.AddMvc(opt =>
    {
        opt.EnableEndpointRouting = false;
    });
    Services.AddCors();
    Services.AddEndpointsApiExplorer();
    Services.AddSwaggerGen();
}

var app = builder.Build();


{
    try
    {
        using var scope = app.Services.CreateScope();
        await Setup.EnsureDb(scope);
    }
    catch (Exception ex)
    {
        Console.WriteLine("Failed to setup the database, aborting");
        Console.WriteLine(ex.ToString());
        Environment.Exit(1);
        return;
    }

    app.UsePathBase("/api");

    app.UseCors(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());

    if (!app.Environment.IsDevelopment())
    {
        app.UseExceptionHandler(err =>
            err.Run(async context =>
            {
                context.Response.StatusCode = 500;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(
                    new { errors = new[] { "An unexpected error occurred." } }
                );
            })
        );
    }
    
    app
        .UseMvc()
        .UseSwagger()
        .UseSwaggerUI();
}

app.Run();
